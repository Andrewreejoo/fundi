import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeMwPhone } from '../common/phone';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { transition } from '../orders/state';
import { LedgerService } from '../payments/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { CARD, CARD_FROM } from '../vehicles/vehicles.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DbService,
    private readonly notifications: NotificationsService,
    private readonly paymentsSvc: PaymentsService,
    private readonly ledger: LedgerService,
  ) {}

  async overview(days = 7) {
    const d = String(days);
    const stats = await this.db.one(
      `SELECT
         (SELECT count(*) FROM vehicles WHERE purpose='sale' AND status IN ('live','reserved')) AS live_for_sale,
         (SELECT count(*) FROM vehicles WHERE purpose='rent' AND status='live') AS live_for_rent,
         (SELECT count(*) FROM vehicles WHERE status='pending') AS pending_listings,
         (SELECT count(*) FROM vehicles WHERE status='sold' AND updated_at > now() - ($1 || ' days')::interval) AS sold,
         (SELECT count(*) FROM vehicles WHERE created_at > now() - ($1 || ' days')::interval) AS new_listings,
         (SELECT count(*) FROM sellers) AS sellers,
         (SELECT count(*) FROM sellers WHERE kind='dealer' AND NOT verified) AS unverified_dealers,
         (SELECT count(*) FROM orders WHERE kind='reservation' AND status IN ('reserved','handed_over','completed') AND created_at > now() - ($1 || ' days')::interval) AS reservations,
         (SELECT count(*) FROM orders WHERE kind='rental' AND status IN ('confirmed','returned','completed') AND created_at > now() - ($1 || ' days')::interval) AS rentals,
         (SELECT COALESCE(sum(amount_mwk),0) FROM orders WHERE status='completed' AND completed_at > now() - ($1 || ' days')::interval) AS completed_value_mwk,
         (SELECT -COALESCE(sum(amount_mwk),0) FROM ledger_entries WHERE account='escrow') AS escrow_held_mwk,
         (SELECT -COALESCE(sum(amount_mwk),0) FROM ledger_entries WHERE account='fee_revenue') AS fee_revenue_mwk,
         (SELECT round(100.0 * count(*) FILTER (WHERE status='success') / NULLIF(count(*) FILTER (WHERE status <> 'pending'),0), 1)
            FROM payments WHERE direction='collect' AND created_at > now() - ($1 || ' days')::interval) AS payment_success_pct,
         (SELECT count(*) FROM inquiries WHERE created_at > now() - ($1 || ' days')::interval) AS inquiries,
         (SELECT count(*) FROM users WHERE created_at > now() - ($1 || ' days')::interval) AS new_users,
         (SELECT count(*) FROM disputes WHERE status='open') AS open_disputes,
         (SELECT count(*) FROM payments WHERE direction <> 'collect' AND status='failed') AS failed_payouts`,
      [d],
    );
    const byMake = await this.db.query(
      `SELECT mk.name, count(*) FILTER (WHERE v.purpose='sale') AS sale, count(*) FILTER (WHERE v.purpose='rent') AS rent
         FROM vehicles v JOIN makes mk ON mk.id=v.make_id WHERE v.status IN ('live','reserved') GROUP BY mk.name ORDER BY count(*) DESC LIMIT 10`,
    );
    const byDistrict = await this.db.query(
      `SELECT district, count(*) AS listings FROM vehicles WHERE status IN ('live','reserved') GROUP BY district ORDER BY count(*) DESC`,
    );
    return { days, ...stats, byMake, byDistrict };
  }

  // ---------- listings
  listings(status = 'pending') {
    return this.db.query(
      `SELECT ${CARD}, v.photo_ids, v.description, v.reject_reason, v.created_at, v.plate, su.phone AS seller_phone
         ${CARD_FROM} WHERE v.status=$1 ORDER BY v.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`,
      [status],
    );
  }

  async reviewListing(id: string, adminId: string, approve: boolean, reason?: string) {
    const v = await this.db.one(
      `UPDATE vehicles SET status=$2, reject_reason=$3, published_at = COALESCE(published_at, CASE WHEN $2='live' THEN now() END), updated_at=now()
        WHERE id=$1 AND status IN ('pending','rejected','live','paused') RETURNING seller_id, stock_no`,
      [id, approve ? 'live' : 'rejected', approve ? null : reason],
    );
    if (!v) throw new NotFoundException('Listing not found or not reviewable');
    await this.db.audit(adminId, approve ? 'listing.approve' : 'listing.reject', 'vehicle', id, { reason });
    await this.notifications.notify(v.seller_id, 'listing', approve ? `${v.stock_no} is live` : `${v.stock_no} needs changes`,
      approve ? `Your car ${v.stock_no} is now visible to buyers.` : `Your car ${v.stock_no} was not approved: ${reason}. Edit it and save to send it for review again.`,
      { link: '/seller', sms: !approve });
    return { ok: true };
  }

  async feature(id: string, adminId: string, on: boolean) {
    const v = await this.db.one(`UPDATE vehicles SET featured=$2 WHERE id=$1 RETURNING id`, [id, on]);
    if (!v) throw new NotFoundException();
    await this.db.audit(adminId, on ? 'listing.feature' : 'listing.unfeature', 'vehicle', id);
    return { ok: true };
  }

  // ---------- sellers
  sellers(q?: string) {
    return this.db.query(
      `SELECT s.user_id AS id, s.kind, s.name, s.district, s.area, s.verified, s.status, s.created_at, u.phone,
              (SELECT count(*) FROM vehicles v WHERE v.seller_id=s.user_id AND v.status IN ('live','reserved')) AS live,
              (SELECT count(*) FROM vehicles v WHERE v.seller_id=s.user_id AND v.status='pending') AS pending,
              (SELECT count(*) FROM orders o WHERE o.seller_id=s.user_id AND o.status='completed') AS completed_orders
         FROM sellers s JOIN users u ON u.id=s.user_id
        WHERE ($1::text IS NULL OR s.name ILIKE '%' || $1 || '%' OR u.phone LIKE '%' || $1 || '%')
        ORDER BY s.verified, s.created_at DESC LIMIT 200`,
      [q?.trim() || null],
    );
  }

  async verifySeller(id: string, adminId: string, on: boolean) {
    const s = await this.db.one(`UPDATE sellers SET verified=$2, updated_at=now() WHERE user_id=$1 RETURNING user_id`, [id, on]);
    if (!s) throw new NotFoundException();
    if (on) {
      // A verified seller's waiting listings go live.
      await this.db.query(`UPDATE vehicles SET status='live', published_at=COALESCE(published_at, now()) WHERE seller_id=$1 AND status='pending' AND reject_reason IS NULL`, [id]);
    }
    await this.db.audit(adminId, on ? 'seller.verify' : 'seller.unverify', 'seller', id);
    await this.notifications.notify(id, 'verified', on ? 'You are a verified seller' : 'Verification removed',
      on ? 'Your listings now show the Verified badge and go live without waiting for review.' : 'Your seller verification was removed. Contact support for details.', { link: '/seller', sms: true });
    return { ok: true };
  }

  // ---------- orders and disputes
  orders(status?: string) {
    return this.db.query(
      `SELECT o.id, o.ref, o.kind, o.status, o.price_mwk, o.amount_mwk, o.start_date, o.end_date, o.created_at,
              v.stock_no, mk.name || ' ' || md.name AS car, s.name AS seller_name, bu.phone AS buyer_phone
         FROM orders o JOIN vehicles v ON v.id=o.vehicle_id JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=o.seller_id JOIN users bu ON bu.id=o.buyer_id
        WHERE ($1::text IS NULL OR o.status=$1) ORDER BY o.created_at DESC LIMIT 200`,
      [status || null],
    );
  }

  disputes(status = 'open') {
    return this.db.query(
      `SELECT d.*, o.ref, o.kind, o.status AS order_status, o.amount_mwk, o.price_mwk, o.start_date, o.end_date,
              v.stock_no, mk.name || ' ' || md.name AS car, s.name AS seller_name, su.phone AS seller_phone,
              COALESCE(bu.name,'Buyer') AS buyer_name, bu.phone AS buyer_phone, ob.phone AS opened_by_phone
         FROM disputes d JOIN orders o ON o.id=d.order_id JOIN vehicles v ON v.id=o.vehicle_id
         JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=o.seller_id JOIN users su ON su.id=o.seller_id
         JOIN users bu ON bu.id=o.buyer_id JOIN users ob ON ob.id=d.opened_by
        WHERE d.status=$1 ORDER BY d.sla_due_at ASC LIMIT 100`,
      [status],
    );
  }

  async resolveDispute(id: string, adminId: string, resolution: 'release' | 'refund' | 'split', share?: number, note?: string) {
    let ids: string[] = [];
    await this.db.tx(async (c) => {
      const d = await this.db.one(`SELECT * FROM disputes WHERE id=$1 FOR UPDATE`, [id], c);
      if (!d) throw new NotFoundException();
      if (d.status !== 'open') throw new BadRequestException('Already resolved');
      const o = await this.db.one(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [d.order_id], c);
      const pct = resolution === 'release' ? 100 : resolution === 'refund' ? 0 : share!;
      ids = await this.paymentsSvc.settleInTx(c, o, pct, `dispute ${o.ref} ${resolution} ${pct}%`);
      const to = pct === 0 ? 'refunded' : 'completed';
      await transition(this.db, c, o.id, 'disputed', to, adminId,
        `Dispute resolved: ${resolution}${resolution === 'split' ? ` (${pct}% to seller)` : ''}`, { completed_at: to === 'completed' ? new Date() : null });
      await this.db.query(
        `UPDATE disputes SET status='resolved', resolution=$2, seller_share_percent=$3, admin_note=$4, resolved_by=$5, resolved_at=now() WHERE id=$1`,
        [id, resolution, pct, note ?? null, adminId],
        c,
      );
      await this.db.audit(adminId, 'dispute.resolve', 'dispute', id, { resolution, pct, note }, c);
      const msg = `Problem on ${o.ref} resolved: ${resolution === 'release' ? 'payment released to the seller' : resolution === 'refund' ? 'buyer refunded' : `split, ${pct}% to the seller`}.${note ? ` ${note}` : ''}`;
      for (const uid of [o.buyer_id, o.seller_id]) await this.notifications.notify(uid, 'dispute_resolved', 'Problem resolved', msg, { link: `/orders/${o.id}`, sms: true }, c);
    });
    await this.paymentsSvc.dispatch(ids);
    return { ok: true };
  }

  // ---------- users, payments, ledger, audit
  users(phone?: string) {
    const p = phone ? normalizeMwPhone(phone) ?? phone : null;
    return this.db.query(
      `SELECT u.id, u.phone, u.name, u.roles, u.status, u.created_at, s.name AS seller_name, s.kind AS seller_kind, s.verified
         FROM users u LEFT JOIN sellers s ON s.user_id=u.id
        WHERE ($1::text IS NULL OR u.phone LIKE '%' || $1 || '%') ORDER BY u.created_at DESC LIMIT 200`,
      [p],
    );
  }

  async setUserStatus(id: string, adminId: string, status: 'active' | 'suspended') {
    const u = await this.db.one(`UPDATE users SET status=$2, updated_at=now() WHERE id=$1 RETURNING id`, [id, status]);
    if (!u) throw new NotFoundException();
    if (status === 'suspended') {
      await this.db.query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [id]);
      await this.db.query(`UPDATE vehicles SET status='paused' WHERE seller_id=$1 AND status='live'`, [id]);
    }
    await this.db.query(`UPDATE sellers SET status=$2 WHERE user_id=$1`, [id, status]);
    await this.db.audit(adminId, `user.${status}`, 'user', id);
    return { ok: true };
  }

  paymentsList(status?: string) {
    return this.db.query(
      `SELECT p.id, p.direction, p.operator, p.msisdn, p.amount_mwk, p.status, p.failure_reason, p.attempts, p.charge_id,
              p.created_at, p.updated_at, o.ref, o.id AS order_id
         FROM payments p JOIN orders o ON o.id=p.order_id
        WHERE ($1::text IS NULL OR p.status=$1) ORDER BY p.created_at DESC LIMIT 200`,
      [status || null],
    );
  }

  ledgerBalances() {
    return this.ledger.balances();
  }

  audit() {
    return this.db.query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.data, a.at, u.phone AS actor_phone
         FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.at DESC LIMIT 200`,
    );
  }
}
