import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { transition } from '../bookings/state';
import { normalizeMwPhone } from '../common/phone';
import { config } from '../config';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerService } from '../payments/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { ProvidersService } from '../providers/providers.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DbService,
    private readonly notifications: NotificationsService,
    private readonly paymentsSvc: PaymentsService,
    private readonly ledger: LedgerService,
    private readonly providers: ProvidersService,
  ) {}

  async overview(days = 7) {
    const stats = await this.db.one(
      `SELECT
         (SELECT count(*) FROM bookings WHERE status='confirmed' AND confirmed_at > now() - ($1 || ' days')::interval) AS completed_jobs,
         (SELECT COALESCE(sum(price_mwk),0) FROM bookings WHERE status='confirmed' AND confirmed_at > now() - ($1 || ' days')::interval) AS gmv_mwk,
         (SELECT -COALESCE(sum(amount_mwk),0) FROM ledger_entries WHERE account='escrow') AS escrow_held_mwk,
         (SELECT COALESCE(sum(amount_mwk),0) * -1 FROM ledger_entries WHERE account='fee_revenue') AS fee_revenue_mwk,
         (SELECT round(100.0 * count(*) FILTER (WHERE status='success') / NULLIF(count(*) FILTER (WHERE status <> 'pending'),0), 1)
            FROM payments WHERE direction='collect' AND created_at > now() - ($1 || ' days')::interval) AS payment_success_pct,
         (SELECT count(*) FROM bookings WHERE created_at > now() - ($1 || ' days')::interval) AS new_bookings,
         (SELECT count(*) FROM provider_profiles WHERE created_at > now() - ($1 || ' days')::interval) AS new_providers,
         (SELECT count(*) FROM users WHERE created_at > now() - ($1 || ' days')::interval) AS new_users,
         (SELECT count(*) FROM verification_requests WHERE status='pending') AS pending_verifications,
         (SELECT count(*) FROM listings WHERE status='pending') AS pending_listings,
         (SELECT count(*) FROM disputes WHERE status='open') AS open_disputes,
         (SELECT count(*) FROM payments WHERE direction <> 'collect' AND status='failed') AS failed_payouts,
         (SELECT min(created_at) FROM bookings WHERE status IN ('paid','in_progress','completed','disputed') AND escrow) AS oldest_escrow_at`,
      [String(days)],
    );
    const byDistrict = await this.db.query(
      `SELECT p.district, count(DISTINCT p.user_id) AS providers,
              count(b.id) FILTER (WHERE b.status='confirmed') AS completed_jobs
         FROM provider_profiles p LEFT JOIN bookings b ON b.provider_id=p.user_id
        GROUP BY p.district ORDER BY providers DESC`,
    );
    return { days, ...stats, byDistrict };
  }

  // ---------- verification
  verifications(status = 'pending') {
    return this.db.query(
      `SELECT v.id, v.status, v.reason, v.created_at, v.reviewed_at, v.id_file_id, v.selfie_file_id,
              p.user_id AS provider_id, p.display_name, p.district, p.area, u.phone, u.name,
              (SELECT string_agg(c.name_en, ', ') FROM provider_trades t JOIN categories c ON c.id=t.category_id WHERE t.provider_id=p.user_id) AS trades,
              ag.phone AS onboarded_by_phone
         FROM verification_requests v
         JOIN provider_profiles p ON p.user_id=v.provider_id
         JOIN users u ON u.id=p.user_id
         LEFT JOIN users ag ON ag.id=p.onboarded_by
        WHERE v.status=$1 ORDER BY v.created_at ASC LIMIT 100`,
      [status],
    );
  }

  async reviewVerification(id: string, adminId: string, approve: boolean, reason?: string) {
    return this.db.tx(async (c) => {
      const v = await this.db.one(`SELECT * FROM verification_requests WHERE id=$1 FOR UPDATE`, [id], c);
      if (!v) throw new NotFoundException();
      if (v.status !== 'pending') throw new BadRequestException('Already reviewed');
      await this.db.query(
        `UPDATE verification_requests SET status=$2, reason=$3, reviewer_id=$4, reviewed_at=now() WHERE id=$1`,
        [id, approve ? 'approved' : 'rejected', reason ?? null, adminId],
        c,
      );
      if (approve) {
        await this.db.query(
          `UPDATE provider_profiles SET verification_level='id_verified', badges = array(SELECT DISTINCT unnest(badges || '{id_verified}'::text[])), updated_at=now() WHERE user_id=$1`,
          [v.provider_id],
          c,
        );
        await this.providers.recomputeTrust(v.provider_id, c);
        // Pending listings from a now-verified provider go live unless flagged by the word filter.
        await this.db.query(`UPDATE listings SET status='live', updated_at=now() WHERE provider_id=$1 AND status='pending' AND reject_reason IS NULL`, [v.provider_id], c);
      }
      await this.db.audit(adminId, approve ? 'verification.approve' : 'verification.reject', 'verification', id, { reason }, c);
      await this.notifications.notify(v.provider_id, 'verification', approve ? 'ID verified' : 'ID not verified',
        approve ? 'Your ID is verified. You now show the verified tick and rank higher in search.' : `We could not verify your ID: ${reason}. Please upload clear photos again.`,
        { sms: true }, c);
      return { ok: true };
    });
  }

  // ---------- listings
  listings(status = 'pending') {
    return this.db.query(
      `SELECT l.*, p.display_name, p.verification_level, c.name_en AS category_name
         FROM listings l JOIN provider_profiles p ON p.user_id=l.provider_id JOIN categories c ON c.id=l.category_id
        WHERE l.status=$1 ORDER BY l.created_at ASC LIMIT 100`,
      [status],
    );
  }

  async reviewListing(id: string, adminId: string, approve: boolean, reason?: string) {
    const l = await this.db.one(
      `UPDATE listings SET status=$2, reject_reason=$3, updated_at=now() WHERE id=$1 RETURNING provider_id, title`,
      [id, approve ? 'live' : 'rejected', approve ? null : reason],
    );
    if (!l) throw new NotFoundException();
    await this.db.audit(adminId, approve ? 'listing.approve' : 'listing.reject', 'listing', id, { reason });
    await this.notifications.notify(l.provider_id, 'listing', approve ? 'Service is live' : 'Service needs changes',
      approve ? `"${l.title}" is now visible to customers.` : `"${l.title}" was not approved: ${reason}. Edit it and save again.`, { sms: !approve });
    return { ok: true };
  }

  // ---------- disputes
  disputes(status = 'open') {
    return this.db.query(
      `SELECT d.*, b.ref, b.status AS booking_status, b.price_mwk, b.escrow, b.description,
              p.display_name AS provider_name, pu.phone AS provider_phone, cu.phone AS customer_phone, COALESCE(cu.name,'Customer') AS customer_name,
              ob.phone AS opened_by_phone
         FROM disputes d JOIN bookings b ON b.id=d.booking_id
         JOIN provider_profiles p ON p.user_id=b.provider_id JOIN users pu ON pu.id=b.provider_id
         JOIN users cu ON cu.id=b.customer_id JOIN users ob ON ob.id=d.opened_by
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
      const b = await this.db.one(`SELECT * FROM bookings WHERE id=$1 FOR UPDATE`, [d.booking_id], c);
      const pct = resolution === 'release' ? 100 : resolution === 'refund' ? 0 : share!;
      if (b.escrow) ids = await this.paymentsSvc.settleInTx(c, b, pct, resolution === 'refund');
      const to = pct === 0 ? 'refunded' : 'confirmed';
      await transition(this.db, c, b.id, 'disputed', to, adminId, `Dispute resolved: ${resolution}${resolution === 'split' ? ` ${pct}% to fundi` : ''}`, {
        confirmed_at: to === 'confirmed' ? new Date() : null,
      });
      if (to === 'confirmed') await this.db.query(`UPDATE provider_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id=$1`, [b.provider_id], c);
      await this.db.query(
        `UPDATE disputes SET status='resolved', resolution=$2, provider_share_percent=$3, admin_note=$4, resolved_by=$5, resolved_at=now() WHERE id=$1`,
        [id, resolution, pct, note ?? null, adminId],
        c,
      );
      await this.providers.recomputeTrust(b.provider_id, c);
      await this.db.audit(adminId, 'dispute.resolve', 'dispute', id, { resolution, pct, note }, c);
      const msg = `Problem on ${b.ref} resolved: ${resolution === 'release' ? 'payment released to the fundi' : resolution === 'refund' ? 'customer refunded' : `split, ${pct}% to the fundi`}.`;
      for (const uid of [b.customer_id, b.provider_id]) await this.notifications.notify(uid, 'dispute_resolved', 'Problem resolved', msg, { bookingId: b.id, sms: true }, c);
    });
    await this.paymentsSvc.dispatch(ids);
    return { ok: true };
  }

  // ---------- users, bookings, payments
  users(phone?: string) {
    const p = phone ? normalizeMwPhone(phone) ?? phone : null;
    return this.db.query(
      `SELECT u.id, u.phone, u.name, u.roles, u.status, u.created_at, p.display_name, p.verification_level, p.district
         FROM users u LEFT JOIN provider_profiles p ON p.user_id=u.id
        WHERE ($1::text IS NULL OR u.phone LIKE '%' || $1 || '%') ORDER BY u.created_at DESC LIMIT 100`,
      [p],
    );
  }

  async setUserStatus(id: string, adminId: string, status: 'active' | 'suspended') {
    const u = await this.db.one(`UPDATE users SET status=$2, updated_at=now() WHERE id=$1 RETURNING id`, [id, status]);
    if (!u) throw new NotFoundException();
    if (status === 'suspended') await this.db.query(`UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [id]);
    await this.db.audit(adminId, `user.${status}`, 'user', id);
    return { ok: true };
  }

  async setRole(id: string, adminId: string, role: 'agent' | 'admin', op: 'add' | 'remove') {
    const u = await this.db.one(
      op === 'add'
        ? `UPDATE users SET roles = array(SELECT DISTINCT unnest(roles || ARRAY[$2]::text[])) WHERE id=$1 RETURNING roles`
        : `UPDATE users SET roles = array_remove(roles, $2) WHERE id=$1 RETURNING roles`,
      [id, role],
    );
    if (!u) throw new NotFoundException();
    await this.db.audit(adminId, `role.${op}`, 'user', id, { role });
    return u;
  }

  bookings(status?: string) {
    return this.db.query(
      `SELECT b.id, b.ref, b.status, b.type, b.price_mwk, b.escrow, b.created_at, b.channel,
              p.display_name AS provider_name, cu.phone AS customer_phone, c.name_en AS category
         FROM bookings b JOIN provider_profiles p ON p.user_id=b.provider_id JOIN users cu ON cu.id=b.customer_id
         JOIN categories c ON c.id=b.category_id
        WHERE ($1::text IS NULL OR b.status=$1) ORDER BY b.created_at DESC LIMIT 200`,
      [status ?? null],
    );
  }

  paymentsList(status?: string) {
    return this.db.query(
      `SELECT p.id, p.direction, p.operator, p.msisdn, p.amount_mwk, p.status, p.failure_reason, p.attempts, p.charge_id,
              p.created_at, p.updated_at, b.ref
         FROM payments p JOIN bookings b ON b.id=p.booking_id
        WHERE ($1::text IS NULL OR p.status=$1) ORDER BY p.created_at DESC LIMIT 200`,
      [status ?? null],
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

  /** Delete ID and selfie images after the retention period; the decision record stays (spec 2.9). */
  async purgeIdImages() {
    const rows = await this.db.query(
      `SELECT v.id, v.id_file_id, v.selfie_file_id FROM verification_requests v
        WHERE v.status <> 'pending' AND v.purged_at IS NULL AND v.reviewed_at < now() - ($1 || ' days')::interval LIMIT 100`,
      [String(config.idImageRetentionDays)],
    );
    for (const r of rows) {
      const files = await this.db.query(`SELECT id, path FROM files WHERE id = ANY($1::uuid[])`, [[r.id_file_id, r.selfie_file_id].filter(Boolean)]);
      for (const f of files) fs.rmSync(path.join(config.uploadDir, f.path), { force: true });
      await this.db.query(`UPDATE verification_requests SET id_file_id=NULL, selfie_file_id=NULL, purged_at=now() WHERE id=$1`, [r.id]);
      await this.db.query(`DELETE FROM files WHERE id = ANY($1::uuid[])`, [files.map((f) => f.id)]);
    }
    return rows.length;
  }
}
