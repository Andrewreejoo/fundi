import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Operator, normalizeMwPhone, operatorFor } from '../common/phone';
import { addHours, formatMwk, percentOf } from '../common/util';
import { config } from '../config';
import { DbService, Queryable } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { transition } from '../orders/state';
import { DriverResult, PAYMENT_DRIVER, PaymentDriver } from './driver';
import { LedgerService } from './ledger.service';

const MAX_PAYOUT_ATTEMPTS = 5;
const COLLECT_TIMEOUT_MIN = 30;

interface PaymentRow {
  id: string;
  order_id: string;
  direction: 'collect' | 'payout' | 'refund';
  operator: Operator;
  msisdn: string;
  amount_mwk: number;
  charge_id: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
}

/**
 * Mobile money in and out of escrow. Buyers pay into the platform's PayChangu balance; the ledger records
 * who the money belongs to; payouts and refunds go back out to Airtel Money / TNM Mpamba wallets.
 */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_DRIVER) private readonly driver: PaymentDriver,
  ) {}

  // ---------------------------------------------------------------- collect

  async startCollect(orderId: string, buyerId: string, payPhone?: string) {
    const o = await this.db.one(
      `SELECT o.*, u.phone AS buyer_phone, u.name AS buyer_name FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=$1`,
      [orderId],
    );
    if (!o || o.buyer_id !== buyerId) throw new NotFoundException('Order not found');
    if (o.status !== 'pending_payment') throw new BadRequestException('This order is not waiting for payment');
    const msisdn = normalizeMwPhone(payPhone ?? o.buyer_phone);
    if (!msisdn) throw new BadRequestException('Enter an Airtel Money or TNM Mpamba number');
    const pending = await this.db.one(
      `SELECT id FROM payments WHERE order_id=$1 AND direction='collect' AND status='pending' AND created_at > now() - interval '3 minutes'`,
      [orderId],
    );
    if (pending) throw new BadRequestException('A payment request is already on your phone. Approve it with your PIN, or wait 3 minutes.');

    const attempt = await this.db.one<{ n: number }>(`SELECT count(*) AS n FROM payments WHERE order_id=$1 AND direction='collect'`, [orderId]);
    const payment = await this.db.one<PaymentRow>(
      `INSERT INTO payments (order_id, direction, operator, msisdn, amount_mwk, charge_id, next_check_at)
       VALUES ($1,'collect',$2,$3,$4,$5, now() + interval '1 minute') RETURNING *`,
      [orderId, operatorFor(msisdn), msisdn, o.amount_mwk, `${o.ref}-C${attempt!.n + 1}`],
    );
    const [first, ...rest] = String(o.buyer_name ?? '').split(' ');
    const result = await this.driver.charge({
      chargeId: payment!.charge_id, msisdn, operator: operatorFor(msisdn)!, amountMwk: Number(o.amount_mwk),
      firstName: first || null, lastName: rest.join(' ') || null,
    });
    await this.apply(payment!.id, result);
    return this.get(payment!.id, buyerId);
  }

  async get(paymentId: string, userId?: string) {
    const p = await this.db.one(
      `SELECT p.id, p.order_id, p.direction, p.operator, p.amount_mwk, p.status, p.failure_reason, p.created_at, p.updated_at,
              o.buyer_id, o.seller_id, o.status AS order_status
         FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id=$1`,
      [paymentId],
    );
    if (!p || (userId && p.buyer_id !== userId && p.seller_id !== userId)) throw new NotFoundException('Payment not found');
    delete p.buyer_id; delete p.seller_id;
    return p;
  }

  // ---------------------------------------------------------------- applying aggregator results

  /** Record a driver result and run its side effects. Idempotent: a settled payment is never applied twice. */
  async apply(paymentId: string, r: DriverResult) {
    if (r.status === 'pending') {
      await this.db.query(`UPDATE payments SET raw = COALESCE($2, raw), updated_at=now() WHERE id=$1 AND status='pending'`, [paymentId, r.raw ? JSON.stringify(r.raw) : null]);
      return;
    }
    const afterCommit: (() => Promise<void>)[] = [];
    await this.db.tx(async (c) => {
      const p = await this.db.one<PaymentRow>(`SELECT * FROM payments WHERE id=$1 FOR UPDATE`, [paymentId], c);
      if (!p || p.status !== 'pending') return;
      await this.db.query(
        `UPDATE payments SET status=$2, provider_ref=COALESCE($3, provider_ref), failure_reason=$4, raw=COALESCE($5, raw),
                next_check_at = CASE WHEN $2='failed' AND direction <> 'collect' AND attempts < $6
                                     THEN now() + (attempts * 15 || ' minutes')::interval END,
                updated_at=now()
          WHERE id=$1`,
        [p.id, r.status, r.providerRef ?? null, r.failureReason ?? null, r.raw ? JSON.stringify(r.raw) : null, MAX_PAYOUT_ATTEMPTS],
        c,
      );
      if (p.direction === 'collect') {
        if (r.status === 'success') await this.onCollectSuccess(c, p, afterCommit);
        else await this.onCollectFailed(c, p, r.failureReason);
      } else if (r.status === 'success') {
        await this.ledger.post(c, p.order_id, `${p.direction} ${p.charge_id}`, [
          { account: p.direction === 'payout' ? 'seller_payable' : 'buyer_refundable', amount: Number(p.amount_mwk) },
          { account: 'cash', amount: -Number(p.amount_mwk) },
        ]);
        const o = await this.db.one('SELECT id, ref, seller_id, buyer_id FROM orders WHERE id=$1', [p.order_id], c);
        await this.notifications.notify(
          p.direction === 'payout' ? o.seller_id : o.buyer_id,
          p.direction, p.direction === 'payout' ? 'Money sent' : 'Refund sent',
          `${formatMwk(Number(p.amount_mwk))} has been sent to your ${p.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'} for order ${o.ref}.`,
          { link: `/orders/${o.id}`, sms: true }, c,
        );
      } else {
        this.log.warn(`${p.direction} ${p.charge_id} failed (attempt ${p.attempts}): ${r.failureReason}`);
      }
    });
    for (const fn of afterCommit) await fn();
  }

  private async onCollectSuccess(c: Queryable, p: PaymentRow, afterCommit: (() => Promise<void>)[]) {
    const o = await this.db.one(
      `SELECT o.*, v.stock_no, mk.name || ' ' || md.name AS car FROM orders o JOIN vehicles v ON v.id=o.vehicle_id
         JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id WHERE o.id=$1 FOR UPDATE OF o`,
      [p.order_id], c,
    );
    await this.ledger.post(c, o.id, `collect ${p.charge_id}`, [
      { account: 'cash', amount: Number(p.amount_mwk) },
      { account: 'escrow', amount: -Number(p.amount_mwk) },
    ]);
    if (o.status !== 'pending_payment') {
      // Money arrived after the order was cancelled or expired: give it all back.
      this.log.warn(`Late payment for ${o.ref} in status ${o.status}; refunding`);
      const ids = await this.settleInTx(c, o, 0, `late payment ${o.ref}`);
      afterCommit.push(() => this.dispatch(ids));
      return;
    }
    const link = `/orders/${o.id}`;
    if (o.kind === 'reservation') {
      const until = addHours(new Date(), config.reservationHoldHours);
      await transition(this.db, c, o.id, 'pending_payment', 'reserved', null, `Deposit ${formatMwk(Number(p.amount_mwk))} paid`, { expires_at: until });
      await this.notifications.notify(o.buyer_id, 'reserved', 'Car reserved for you',
        `${o.car} (${o.stock_no}) is reserved for you for ${config.reservationHoldHours} hours. Your deposit of ${formatMwk(Number(o.amount_mwk))} is held safely. Visit the seller to view and buy it.`,
        { link, sms: true }, c);
      await this.notifications.notify(o.seller_id, 'reserved', 'Your car has been reserved',
        `${o.car} (${o.stock_no}) was reserved with a ${formatMwk(Number(o.amount_mwk))} deposit (order ${o.ref}). Contact the buyer to arrange viewing.`,
        { link, sms: true }, c);
    } else {
      await transition(this.db, c, o.id, 'pending_payment', 'confirmed', null, `Paid ${formatMwk(Number(p.amount_mwk))}`, { expires_at: null });
      await this.notifications.notify(o.buyer_id, 'confirmed', 'Rental confirmed',
        `Your rental of ${o.car} from ${o.start_date} to ${o.end_date} is confirmed (order ${o.ref}).`, { link, sms: true }, c);
      await this.notifications.notify(o.seller_id, 'confirmed', 'New rental booking',
        `${o.car} (${o.stock_no}) is booked ${o.start_date} to ${o.end_date}${o.with_driver ? ' with driver' : ''}. Paid ${formatMwk(Number(o.amount_mwk))} (order ${o.ref}).`,
        { link, sms: true }, c);
    }
  }

  private async onCollectFailed(c: Queryable, p: PaymentRow, reason?: string | null) {
    const o = await this.db.one('SELECT id, ref, buyer_id FROM orders WHERE id=$1', [p.order_id], c);
    await this.notifications.notify(o.buyer_id, 'payment_failed', 'Payment did not go through',
      `Payment for ${o.ref} failed${reason ? ` (${reason.slice(0, 80)})` : ''}. Try again or use another wallet.`,
      { link: `/orders/${o.id}` }, c);
  }

  // ---------------------------------------------------------------- settlement

  /**
   * Settle an order's escrow: sellerSharePercent of the paid amount goes to the seller (less the same share of
   * the platform fee); the rest is refunded to the buyer. Creates payout/refund rows inside the caller's
   * transaction; call dispatch(ids) after commit.
   */
  async settleInTx(c: Queryable, o: any, sellerSharePercent: number, memo: string): Promise<string[]> {
    const amount = Number(o.amount_mwk);
    const sellerGross = percentOf(amount, sellerSharePercent);
    const fee = percentOf(Number(o.fee_mwk), sellerSharePercent);
    const net = sellerGross - fee;
    const refund = amount - sellerGross;
    await this.ledger.post(c, o.id, memo, [
      { account: 'escrow', amount },
      { account: 'seller_payable', amount: -net },
      { account: 'fee_revenue', amount: -fee },
      { account: 'buyer_refundable', amount: -refund },
    ]);
    const ids: string[] = [];
    if (net > 0) {
      const s = await this.db.one('SELECT payout_msisdn, payout_operator FROM sellers WHERE user_id=$1', [o.seller_id], c);
      const row = await this.db.one(
        `INSERT INTO payments (order_id, direction, operator, msisdn, amount_mwk, charge_id) VALUES ($1,'payout',$2,$3,$4,$5) RETURNING id`,
        [o.id, s.payout_operator, s.payout_msisdn, net, `${o.ref}-P1`],
        c,
      );
      ids.push(row.id);
    }
    if (refund > 0) {
      const collect = await this.db.one(
        `SELECT operator, msisdn FROM payments WHERE order_id=$1 AND direction='collect' AND status='success' ORDER BY updated_at DESC LIMIT 1`,
        [o.id],
        c,
      );
      const row = await this.db.one(
        `INSERT INTO payments (order_id, direction, operator, msisdn, amount_mwk, charge_id) VALUES ($1,'refund',$2,$3,$4,$5) RETURNING id`,
        [o.id, collect.operator, collect.msisdn, refund, `${o.ref}-R1`],
        c,
      );
      ids.push(row.id);
    }
    return ids;
  }

  /** Send queued payouts/refunds to the aggregator. Safe to call repeatedly. */
  async dispatch(ids: string[]) {
    for (const id of ids) {
      const p = await this.db.one<PaymentRow>(`SELECT * FROM payments WHERE id=$1`, [id]);
      if (!p || p.status !== 'pending' || p.direction === 'collect') continue;
      const r = await this.driver.payout({ chargeId: p.charge_id, msisdn: p.msisdn, operator: p.operator, amountMwk: Number(p.amount_mwk) });
      await this.apply(p.id, r);
    }
  }

  // ---------------------------------------------------------------- webhook + reconciliation

  async handleWebhook(rawBody: string, signature: string | undefined) {
    const evt = this.driver.parseWebhook(rawBody, signature);
    if (!evt) throw new UnauthorizedException('Bad signature');
    const p = await this.db.one<PaymentRow>('SELECT * FROM payments WHERE charge_id=$1', [evt.chargeId]);
    if (!p) return { ok: true, ignored: 'unknown charge' };
    if (p.direction === 'collect') {
      // Never trust the webhook body alone for money in: confirm with the verify endpoint.
      const verified = await this.driver.verifyCharge(p.charge_id);
      await this.apply(p.id, verified.status === 'pending' ? { status: evt.status, raw: evt.raw } : verified);
    } else {
      await this.apply(p.id, { status: evt.status, raw: evt.raw });
    }
    return { ok: true };
  }

  /** Run by the scheduler every minute. */
  async reconcile() {
    const collects = await this.db.query<PaymentRow & { age_min: number }>(
      `SELECT *, extract(epoch FROM now() - created_at) / 60 AS age_min FROM payments
        WHERE direction='collect' AND status='pending' AND (next_check_at IS NULL OR next_check_at <= now()) LIMIT 50`,
    );
    for (const p of collects) {
      const r = await this.driver.verifyCharge(p.charge_id);
      if (r.status === 'pending' && p.age_min >= COLLECT_TIMEOUT_MIN) {
        await this.apply(p.id, { status: 'failed', failureReason: 'Not approved in time' });
      } else {
        await this.apply(p.id, r);
        await this.db.query(`UPDATE payments SET next_check_at = now() + interval '2 minutes' WHERE id=$1 AND status='pending'`, [p.id]);
      }
    }
    const retries = await this.db.query<PaymentRow>(
      `SELECT * FROM payments WHERE direction <> 'collect' AND status='failed' AND next_check_at <= now() AND attempts < $1 LIMIT 20`,
      [MAX_PAYOUT_ATTEMPTS],
    );
    for (const p of retries) await this.retry(p.id);
  }

  async retry(paymentId: string) {
    const p = await this.db.one<PaymentRow>(
      `UPDATE payments SET status='pending', attempts = attempts + 1, next_check_at = NULL, failure_reason = NULL,
              charge_id = regexp_replace(charge_id, '-[PR]\\d+$', '') || CASE direction WHEN 'payout' THEN '-P' ELSE '-R' END || (attempts + 1),
              updated_at = now()
        WHERE id=$1 AND direction <> 'collect' AND status='failed' RETURNING *`,
      [paymentId],
    );
    if (!p) throw new BadRequestException('Only failed payouts or refunds can be retried');
    await this.dispatch([p.id]);
    return this.get(p.id);
  }
}
