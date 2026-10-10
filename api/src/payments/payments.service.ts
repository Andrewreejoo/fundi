import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Operator, normalizeMwPhone, operatorFor } from '../common/phone';
import { formatMwk, percentOf } from '../common/util';
import { DbService, Queryable } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { transition } from '../bookings/state';
import { DriverResult, PAYMENT_DRIVER, PaymentDriver } from './driver';
import { LedgerService } from './ledger.service';

const MAX_PAYOUT_ATTEMPTS = 5;
const COLLECT_TIMEOUT_MIN = 30;

interface PaymentRow {
  id: string;
  booking_id: string;
  direction: 'collect' | 'payout' | 'refund';
  operator: Operator;
  msisdn: string;
  amount_mwk: number;
  charge_id: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
}

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly db: DbService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_DRIVER) private readonly driver: PaymentDriver,
  ) {}

  // ---------------------------------------------------------------- collect (customer pays into escrow)

  async startCollect(bookingId: string, customerId: string, payPhone?: string) {
    const b = await this.db.one(
      `SELECT b.*, u.phone AS customer_phone, u.name AS customer_name FROM bookings b JOIN users u ON u.id=b.customer_id WHERE b.id=$1`,
      [bookingId],
    );
    if (!b || b.customer_id !== customerId) throw new NotFoundException('Booking not found');
    if (b.status !== 'accepted') throw new BadRequestException('This booking is not waiting for payment');
    if (!b.escrow) throw new BadRequestException('This booking is paid directly to the fundi');
    const msisdn = normalizeMwPhone(payPhone ?? b.customer_phone);
    if (!msisdn) throw new BadRequestException('Enter an Airtel Money or TNM Mpamba number');
    const pending = await this.db.one(
      `SELECT id FROM payments WHERE booking_id=$1 AND direction='collect' AND status='pending' AND created_at > now() - interval '3 minutes'`,
      [bookingId],
    );
    if (pending) throw new BadRequestException('A payment request is already on your phone. Approve it with your PIN, or wait 3 minutes.');

    const attempt = await this.db.one<{ n: number }>(`SELECT count(*) AS n FROM payments WHERE booking_id=$1 AND direction='collect'`, [bookingId]);
    const total = b.price_mwk + b.protection_fee_mwk;
    const payment = await this.db.one<PaymentRow>(
      `INSERT INTO payments (booking_id, direction, operator, msisdn, amount_mwk, charge_id, next_check_at)
       VALUES ($1,'collect',$2,$3,$4,$5, now() + interval '1 minute') RETURNING *`,
      [bookingId, operatorFor(msisdn), msisdn, total, `${b.ref}-C${attempt!.n + 1}`],
    );
    const [first, ...rest] = String(b.customer_name ?? '').split(' ');
    const result = await this.driver.charge({
      chargeId: payment!.charge_id, msisdn, operator: operatorFor(msisdn)!, amountMwk: total,
      firstName: first || null, lastName: rest.join(' ') || null,
    });
    await this.apply(payment!.id, result);
    return this.get(payment!.id, customerId);
  }

  async get(paymentId: string, userId?: string) {
    const p = await this.db.one(
      `SELECT p.id, p.booking_id, p.direction, p.operator, p.amount_mwk, p.status, p.failure_reason, p.created_at, p.updated_at,
              b.customer_id, b.provider_id, b.status AS booking_status
         FROM payments p JOIN bookings b ON b.id = p.booking_id WHERE p.id=$1`,
      [paymentId],
    );
    if (!p || (userId && p.customer_id !== userId && p.provider_id !== userId)) throw new NotFoundException('Payment not found');
    delete p.customer_id; delete p.provider_id;
    return p;
  }

  // ---------------------------------------------------------------- applying aggregator results

  /** Record a driver result and run the side effects of success. Idempotent: a settled payment is never re-applied. */
  async apply(paymentId: string, r: DriverResult) {
    if (r.status === 'pending') {
      await this.db.query(`UPDATE payments SET raw = COALESCE($2, raw), updated_at=now() WHERE id=$1 AND status='pending'`, [paymentId, r.raw ? JSON.stringify(r.raw) : null]);
      return;
    }
    const afterCommit: (() => Promise<void>)[] = [];
    await this.db.tx(async (c) => {
      const p = await this.db.one<PaymentRow>(`SELECT * FROM payments WHERE id=$1 FOR UPDATE`, [paymentId], c);
      if (!p || p.status !== 'pending') return; // already handled (webhook + poll race)
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
        await this.ledger.post(c, p.booking_id, `${p.direction} ${p.charge_id}`, [
          { account: p.direction === 'payout' ? 'provider_payable' : 'customer_refundable', amount: p.amount_mwk },
          { account: 'cash', amount: -p.amount_mwk },
        ]);
        const b = await this.db.one('SELECT ref, provider_id, customer_id FROM bookings WHERE id=$1', [p.booking_id], c);
        await this.notifications.notify(
          p.direction === 'payout' ? b.provider_id : b.customer_id,
          p.direction, p.direction === 'payout' ? 'Ndalama zatumizidwa' : 'Refund sent',
          `${formatMwk(p.amount_mwk)} has been sent to your ${p.operator === 'airtel' ? 'Airtel Money' : 'TNM Mpamba'} for booking ${b.ref}.`,
          { bookingId: p.booking_id, sms: true }, c,
        );
      } else {
        this.log.warn(`${p.direction} ${p.charge_id} failed (attempt ${p.attempts}): ${r.failureReason}`);
      }
    });
    for (const fn of afterCommit) await fn();
  }

  private async onCollectSuccess(c: Queryable, p: PaymentRow, afterCommit: (() => Promise<void>)[]) {
    const b = await this.db.one(`SELECT * FROM bookings WHERE id=$1 FOR UPDATE`, [p.booking_id], c);
    await this.ledger.post(c, b.id, `collect ${p.charge_id}`, [
      { account: 'cash', amount: p.amount_mwk },
      { account: 'escrow', amount: -b.price_mwk },
      { account: 'fee_revenue', amount: -(p.amount_mwk - b.price_mwk) },
    ]);
    if (b.status === 'accepted') {
      await transition(this.db, c, b.id, 'accepted', 'paid', null, `Paid ${formatMwk(p.amount_mwk)}`, { expires_at: null });
      await this.notifications.notify(b.customer_id, 'paid', 'Ndalama zanu zili bwino',
        `${formatMwk(p.amount_mwk)} received for ${b.ref}. We hold it safely and pay the fundi only after you confirm the job is done.`,
        { bookingId: b.id, sms: true }, c);
      await this.notifications.notify(b.provider_id, 'paid', 'Customer has paid',
        `Booking ${b.ref} is paid. ${formatMwk(b.price_mwk)} is held for you until the job is confirmed.`,
        { bookingId: b.id, sms: true }, c);
    } else {
      // Money arrived after the booking was cancelled/expired: give it all back.
      this.log.warn(`Late payment for ${b.ref} in status ${b.status}; refunding`);
      const ids = await this.settleInTx(c, b, 0, true);
      afterCommit.push(() => this.dispatch(ids));
    }
  }

  private async onCollectFailed(c: Queryable, p: PaymentRow, reason?: string | null) {
    const b = await this.db.one('SELECT ref, customer_id FROM bookings WHERE id=$1', [p.booking_id], c);
    await this.notifications.notify(b.customer_id, 'payment_failed', 'Payment did not go through',
      `Payment for ${b.ref} failed${reason ? ` (${reason.slice(0, 80)})` : ''}. Try again or use another wallet.`,
      { bookingId: p.booking_id, sms: true }, c);
  }

  // ---------------------------------------------------------------- settlement (release / refund / split)

  /**
   * Settle an escrow booking. providerSharePercent of the job amount goes to the provider (less commission
   * on that share); the rest is refunded to the customer, plus the protection fee when refundFee is true.
   * Creates payout/refund payment rows in the caller's transaction; call dispatch(ids) after commit.
   */
  async settleInTx(c: Queryable, b: any, providerSharePercent: number, refundFee: boolean): Promise<string[]> {
    const price: number = b.price_mwk;
    const providerGross = percentOf(price, providerSharePercent);
    const commission = percentOf(b.commission_mwk, providerSharePercent);
    const net = providerGross - commission;
    const refundJob = price - providerGross;
    const fee = refundFee ? b.protection_fee_mwk : 0;
    await this.ledger.post(c, b.id, `settle ${b.ref} ${providerSharePercent}%`, [
      { account: 'escrow', amount: price },
      { account: 'provider_payable', amount: -net },
      { account: 'fee_revenue', amount: -commission + fee },
      { account: 'customer_refundable', amount: -(refundJob + fee) },
    ]);
    const ids: string[] = [];
    if (net > 0) {
      const prov = await this.db.one('SELECT payout_msisdn, payout_operator FROM provider_profiles WHERE user_id=$1', [b.provider_id], c);
      const row = await this.db.one(
        `INSERT INTO payments (booking_id, direction, operator, msisdn, amount_mwk, charge_id) VALUES ($1,'payout',$2,$3,$4,$5) RETURNING id`,
        [b.id, prov.payout_operator, prov.payout_msisdn, net, `${b.ref}-P1`],
        c,
      );
      ids.push(row.id);
    }
    if (refundJob + fee > 0) {
      const collect = await this.db.one(
        `SELECT operator, msisdn FROM payments WHERE booking_id=$1 AND direction='collect' AND status='success' ORDER BY updated_at DESC LIMIT 1`,
        [b.id],
        c,
      );
      const row = await this.db.one(
        `INSERT INTO payments (booking_id, direction, operator, msisdn, amount_mwk, charge_id) VALUES ($1,'refund',$2,$3,$4,$5) RETURNING id`,
        [b.id, collect.operator, collect.msisdn, refundJob + fee, `${b.ref}-R1`],
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
      const r = await this.driver.payout({ chargeId: p.charge_id, msisdn: p.msisdn, operator: p.operator, amountMwk: p.amount_mwk });
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
    // 1. Pending collections: poll; give up after COLLECT_TIMEOUT_MIN.
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
    // 2. Failed payouts/refunds due for retry: reopen with a fresh charge id (aggregator needs a unique id per attempt).
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
