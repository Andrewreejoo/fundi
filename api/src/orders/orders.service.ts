import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/auth';
import { maskPhone } from '../common/phone';
import { addHours, addMinutes, bookingRef, formatMwk, percentOf } from '../common/util';
import { config } from '../config';
import { DbService, Queryable } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { OPEN_STATUSES, OrderStatus, transition } from './state';

const DAY_MS = 86_400_000;
const todayIso = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10); // Malawi is UTC+2

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DbService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Refundable reservation deposit for a car price (spec: % of price, clamped, never above the price). */
  static deposit(price: number) {
    const d = Math.min(config.depositMax, Math.max(config.depositMin, percentOf(price, config.depositPercent)));
    return Math.min(d, price);
  }

  private async newRef(c: Queryable) {
    let ref = bookingRef().replace('FD-', 'GO-');
    while (await this.db.one('SELECT 1 FROM orders WHERE ref=$1', [ref], c)) ref = bookingRef().replace('FD-', 'GO-');
    return ref;
  }

  private async vehicle(id: string, c?: Queryable) {
    const v = await this.db.one(
      `SELECT v.*, mk.name || ' ' || md.name AS car, s.status AS seller_status FROM vehicles v
         JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id JOIN sellers s ON s.user_id=v.seller_id
        WHERE v.id=$1`,
      [id],
      c,
    );
    if (!v) throw new NotFoundException('Car not found');
    return v;
  }

  // ---------------------------------------------------------------- create

  async reserve(buyer: AuthUser, vehicleId: string, note?: string) {
    const v = await this.vehicle(vehicleId);
    if (v.purpose !== 'sale') throw new BadRequestException('This car is for rent, not for sale');
    if (v.seller_id === buyer.id) throw new BadRequestException('You cannot reserve your own car');
    if (v.status !== 'live' || v.seller_status !== 'active') throw new BadRequestException(v.status === 'reserved' ? 'This car is already reserved' : 'This car is not available');
    const price = Number(v.price_mwk);
    const deposit = OrdersService.deposit(price);
    const fee = Math.min(deposit, percentOf(price, config.saleFeePercent));
    try {
      const id = await this.db.tx(async (c) => {
        const o = await this.db.one(
          `INSERT INTO orders (ref, kind, vehicle_id, buyer_id, seller_id, status, price_mwk, amount_mwk, fee_mwk, note, expires_at)
           VALUES ($1,'reservation',$2,$3,$4,'pending_payment',$5,$6,$7,$8,$9) RETURNING id`,
          [await this.newRef(c), v.id, buyer.id, v.seller_id, price, deposit, fee, note ?? null, addMinutes(new Date(), config.payWindowMinutes)],
          c,
        );
        await this.db.query(`INSERT INTO order_events (order_id, to_status, actor_id) VALUES ($1,'pending_payment',$2)`, [o.id, buyer.id], c);
        return o.id as string;
      });
      return this.detail(id, buyer);
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Someone else is reserving this car right now. Try again in 30 minutes.');
      throw e;
    }
  }

  async rent(buyer: AuthUser, vehicleId: string, startDate: string, endDate: string, withDriver: boolean, note?: string) {
    const v = await this.vehicle(vehicleId);
    if (v.purpose !== 'rent') throw new BadRequestException('This car is for sale, not for rent');
    if (v.seller_id === buyer.id) throw new BadRequestException('You cannot rent your own car');
    if (v.status !== 'live' || v.seller_status !== 'active') throw new BadRequestException('This car is not available for rent right now');
    if (startDate < todayIso()) throw new BadRequestException('Pick-up date cannot be in the past');
    const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS);
    if (days < 1) throw new BadRequestException('Return date must be after the pick-up date');
    if (days < v.min_days) throw new BadRequestException(`This car is rented for at least ${v.min_days} days`);
    if (days > 60) throw new BadRequestException('Rentals longer than 60 days: contact the owner');
    if (!v.self_drive) withDriver = true;
    if (withDriver && v.driver_rate_mwk == null) throw new BadRequestException('This car is self-drive only');
    const daily = Number(v.daily_rate_mwk);
    const driver = withDriver ? Number(v.driver_rate_mwk) : 0;
    const total = days * (daily + driver);
    const fee = percentOf(total, config.rentalCommissionPercent);
    try {
      const id = await this.db.tx(async (c) => {
        const o = await this.db.one(
          `INSERT INTO orders (ref, kind, vehicle_id, buyer_id, seller_id, status, price_mwk, amount_mwk, fee_mwk, start_date, end_date, days,
                               with_driver, daily_rate_mwk, driver_rate_mwk, note, expires_at)
           VALUES ($1,'rental',$2,$3,$4,'pending_payment',$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
          [await this.newRef(c), v.id, buyer.id, v.seller_id, total, fee, startDate, endDate, days, withDriver, daily, withDriver ? driver : null,
           note ?? null, addMinutes(new Date(), config.payWindowMinutes)],
          c,
        );
        await this.db.query(`INSERT INTO order_events (order_id, to_status, actor_id) VALUES ($1,'pending_payment',$2)`, [o.id, buyer.id], c);
        return o.id as string;
      });
      return this.detail(id, buyer);
    } catch (e: any) {
      if (e.code === '23P01') throw new ConflictException('Those dates are already booked. Choose other dates.');
      throw e;
    }
  }

  // ---------------------------------------------------------------- read

  list(user: AuthUser, as: 'buyer' | 'seller', scope: 'active' | 'past' | 'all') {
    const col = as === 'seller' ? 'o.seller_id' : 'o.buyer_id';
    const filter = scope === 'active' ? 'AND o.status = ANY($2::text[])' : scope === 'past' ? 'AND NOT (o.status = ANY($2::text[]))' : 'AND $2::text[] IS NOT NULL';
    return this.db.query(
      `SELECT o.id, o.ref, o.kind, o.status, o.price_mwk, o.amount_mwk, o.fee_mwk, o.start_date, o.end_date, o.days, o.with_driver,
              o.expires_at, o.created_at, v.id AS vehicle_id, v.stock_no, v.year, v.body_type, v.color, v.photo_ids[1] AS photo_id,
              mk.name AS make, md.name AS model, s.name AS seller_name, COALESCE(bu.name, 'Buyer') AS buyer_name
         FROM orders o JOIN vehicles v ON v.id=o.vehicle_id JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=o.seller_id JOIN users bu ON bu.id=o.buyer_id
        WHERE ${col}=$1 ${filter} ORDER BY o.created_at DESC LIMIT 100`,
      [user.id, OPEN_STATUSES],
    );
  }

  async detail(id: string, user: AuthUser, client?: Queryable) {
    const o = await this.db.one(
      `SELECT o.*, v.stock_no, v.year, v.body_type, v.color, v.photo_ids[1] AS photo_id, v.purpose, v.variant,
              v.district AS vehicle_district, v.area AS vehicle_area,
              mk.name AS make, md.name AS model, s.name AS seller_name, s.kind AS seller_kind, s.address AS seller_address,
              s.area AS seller_area, s.district AS seller_district, su.phone AS seller_phone, bu.phone AS buyer_phone,
              COALESCE(bu.name, 'Buyer') AS buyer_name
         FROM orders o JOIN vehicles v ON v.id=o.vehicle_id JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=o.seller_id JOIN users su ON su.id=o.seller_id JOIN users bu ON bu.id=o.buyer_id
        WHERE o.id=$1`,
      [id],
      client,
    );
    if (!o) throw new NotFoundException('Order not found');
    const isBuyer = o.buyer_id === user.id;
    const isSeller = o.seller_id === user.id;
    const isAdmin = user.roles.includes('admin');
    if (!isBuyer && !isSeller && !isAdmin) throw new NotFoundException('Order not found');
    // Contact numbers are shared once money is held.
    const revealed = !['pending_payment', 'cancelled', 'expired'].includes(o.status) || isAdmin;
    if (!revealed) {
      if (!isSeller) o.seller_phone = maskPhone(o.seller_phone);
      if (!isBuyer) o.buyer_phone = maskPhone(o.buyer_phone);
    }
    const events = await this.db.query(`SELECT from_status, to_status, note, at FROM order_events WHERE order_id=$1 ORDER BY at, id`, [id], client);
    const payments = await this.db.query(
      `SELECT id, direction, operator, amount_mwk, status, failure_reason, created_at, updated_at FROM payments
        WHERE order_id=$1 ${isAdmin ? '' : isSeller ? `AND direction='payout'` : `AND direction <> 'payout'`} ORDER BY created_at`,
      [id],
      client,
    );
    const dispute = await this.db.one(
      `SELECT id, reason, status, resolution, seller_share_percent, admin_note, sla_due_at, created_at, resolved_at FROM disputes WHERE order_id=$1`,
      [id],
      client,
    );
    return {
      ...o,
      role: isBuyer ? 'buyer' : isSeller ? 'seller' : 'admin',
      balance_due_mwk: o.kind === 'reservation' ? Number(o.price_mwk) - Number(o.amount_mwk) : 0,
      seller_net_mwk: Number(o.amount_mwk) - Number(o.fee_mwk),
      actions: this.actionsFor(o, isBuyer, isSeller),
      events, payments, dispute,
    };
  }

  /** What the viewer may do next; the website renders buttons from this list. */
  private actionsFor(o: any, isBuyer: boolean, isSeller: boolean) {
    const a: string[] = [];
    const s: OrderStatus = o.status;
    const started = o.kind === 'rental' && o.start_date <= todayIso();
    if (isBuyer) {
      if (s === 'pending_payment') a.push('pay', 'cancel');
      if (s === 'reserved') a.push('complete', 'cancel', 'dispute');
      if (s === 'confirmed') { if (!started) a.push('cancel'); else a.push('complete'); a.push('dispute'); }
      if (s === 'handed_over' || s === 'returned') a.push('complete', 'dispute');
    }
    if (isSeller) {
      if (s === 'pending_payment') a.push('cancel');
      if (s === 'reserved') a.push('handover', 'cancel');
      if (s === 'confirmed') { if (started) a.push('handover'); else a.push('cancel'); a.push('dispute'); }
      if (s === 'handed_over' || s === 'returned') a.push('dispute');
    }
    return a;
  }

  private async load(id: string, c: Queryable) {
    const o = await this.db.one(
      `SELECT o.*, v.stock_no, mk.name || ' ' || md.name AS car FROM orders o JOIN vehicles v ON v.id=o.vehicle_id
         JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id WHERE o.id=$1 FOR UPDATE OF o`,
      [id],
      c,
    );
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  // ---------------------------------------------------------------- actions

  pay(id: string, user: AuthUser, phone?: string) {
    return this.payments.startCollect(id, user.id, phone);
  }

  async cancel(id: string, user: AuthUser, reason?: string) {
    let ids: string[] = [];
    await this.db.tx(async (c) => {
      const o = await this.load(id, c);
      const isBuyer = o.buyer_id === user.id;
      const isSeller = o.seller_id === user.id;
      if (!isBuyer && !isSeller) throw new NotFoundException('Order not found');
      const link = `/orders/${o.id}`;
      if (o.status === 'pending_payment') {
        await transition(this.db, c, o.id, 'pending_payment', 'cancelled', user.id, reason, { expires_at: null, cancel_reason: isBuyer ? 'buyer' : 'seller' });
      } else if (o.status === 'reserved' || (o.status === 'confirmed' && o.start_date > todayIso())) {
        // Cancelled while money is held: the buyer gets everything back.
        ids = await this.payments.settleInTx(c, o, 0, `cancel ${o.ref}`);
        await transition(this.db, c, o.id, o.status, 'refunded', user.id, reason, { expires_at: null, cancel_reason: isBuyer ? 'buyer' : 'seller' });
      } else {
        throw new BadRequestException(o.status === 'confirmed' ? 'The rental has started. Report a problem instead.' : 'This order can no longer be cancelled');
      }
      const other = isBuyer ? o.seller_id : o.buyer_id;
      await this.notifications.notify(other, 'cancelled', `Order ${o.ref} cancelled`,
        `${o.car} (${o.stock_no}): order ${o.ref} was cancelled${ids.length ? ' and the buyer is being refunded' : ''}.`, { link, sms: true }, c);
    });
    await this.payments.dispatch(ids);
    return this.detail(id, user);
  }

  /** Seller: the buyer has taken the car (reservation) / the rented car has come back (rental). */
  async handover(id: string, user: AuthUser) {
    await this.db.tx(async (c) => {
      const o = await this.load(id, c);
      if (o.seller_id !== user.id) throw new ForbiddenException('Only the seller can do this');
      const auto = addHours(new Date(), config.autoCompleteHours);
      if (o.kind === 'reservation') {
        if (o.status !== 'reserved') throw new BadRequestException('This reservation is not active');
        await transition(this.db, c, o.id, 'reserved', 'handed_over', user.id, null, { auto_complete_at: auto, expires_at: null });
        await this.notifications.notify(o.buyer_id, 'handed_over', 'Did you get the car?',
          `The seller says ${o.car} (${o.stock_no}) has been handed over to you. Confirm in GalimotoYanga, or report a problem within ${config.autoCompleteHours} hours. After that the deposit is released to the seller.`,
          { link: `/orders/${o.id}`, sms: true }, c);
      } else {
        if (o.status !== 'confirmed') throw new BadRequestException('This rental is not active');
        if (o.start_date > todayIso()) throw new BadRequestException('The rental has not started yet');
        await transition(this.db, c, o.id, 'confirmed', 'returned', user.id, null, { auto_complete_at: auto });
        await this.notifications.notify(o.buyer_id, 'returned', 'Car returned',
          `${o.car} was marked as returned. Report a problem within ${config.autoCompleteHours} hours if anything is wrong; otherwise payment is released to the owner.`,
          { link: `/orders/${o.id}`, sms: true }, c);
      }
    });
    return this.detail(id, user);
  }

  /** Buyer confirms (or the timer does): escrow is released to the seller, less the platform fee. */
  async complete(id: string, user: AuthUser | null, note?: string) {
    let ids: string[] = [];
    await this.db.tx(async (c) => {
      const o = await this.load(id, c);
      if (user && o.buyer_id !== user.id) throw new ForbiddenException('Only the buyer can confirm');
      const actor = user?.id ?? null;
      if (o.kind === 'reservation' && o.status === 'reserved') {
        await transition(this.db, c, o.id, 'reserved', 'handed_over', actor, 'Buyer confirmed purchase');
        o.status = 'handed_over';
      }
      if (o.kind === 'rental' && o.status === 'confirmed') {
        if (o.start_date > todayIso()) throw new BadRequestException('The rental has not started yet');
        await transition(this.db, c, o.id, 'confirmed', 'returned', actor, user ? 'Renter confirmed' : 'Rental period ended');
        o.status = 'returned';
      }
      if (!['handed_over', 'returned'].includes(o.status)) throw new BadRequestException('This order cannot be completed now');
      ids = await this.payments.settleInTx(c, o, 100, `release ${o.ref}`);
      await transition(this.db, c, o.id, o.status, 'completed', actor, note ?? (user ? null : 'Completed automatically'), {
        completed_at: new Date(), auto_complete_at: null, expires_at: null,
      });
      await this.notifications.notify(o.seller_id, 'completed', `Order ${o.ref} completed`,
        `${formatMwk(Number(o.amount_mwk) - Number(o.fee_mwk))} is on its way to your mobile money for ${o.car} (${o.stock_no}).`,
        { link: `/orders/${o.id}`, sms: true }, c);
    });
    await this.payments.dispatch(ids);
    return user ? this.detail(id, user) : null;
  }

  async dispute(id: string, user: AuthUser, reason: string) {
    await this.db.tx(async (c) => {
      const o = await this.load(id, c);
      const isBuyer = o.buyer_id === user.id;
      if (!isBuyer && o.seller_id !== user.id) throw new NotFoundException('Order not found');
      if (!['reserved', 'confirmed', 'handed_over', 'returned'].includes(o.status)) throw new BadRequestException('A problem can only be reported while money is held');
      await transition(this.db, c, o.id, o.status, 'disputed', user.id, reason, { auto_complete_at: null, expires_at: null });
      await this.db.query(
        `INSERT INTO disputes (order_id, opened_by, reason, sla_due_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)`,
        [o.id, user.id, reason, String(config.disputeSlaHours)],
        c,
      );
      for (const uid of [o.buyer_id, o.seller_id]) {
        await this.notifications.notify(uid, 'disputed', `Problem reported on ${o.ref}`,
          `The money stays held. GalimotoYanga support will contact both of you within ${config.disputeSlaHours} hours.`, { link: `/orders/${o.id}`, sms: true }, c);
      }
    });
    return this.detail(id, user);
  }

  // ---------------------------------------------------------------- timers

  async sweep() {
    let expired = 0, lapsed = 0, completed = 0;
    // 1. Unpaid orders past the payment window.
    const unpaid = await this.db.query(`SELECT id FROM orders WHERE status='pending_payment' AND expires_at <= now() LIMIT 200`);
    for (const r of unpaid) {
      await this.db.tx(async (c) => {
        const o = await this.load(r.id, c);
        if (o.status !== 'pending_payment' || new Date(o.expires_at) > new Date()) return;
        await transition(this.db, c, o.id, 'pending_payment', 'expired', null, 'Not paid in time', { expires_at: null });
        expired++;
      }).catch(() => undefined);
    }
    // 2. Reservations whose hold ran out without a handover: deposit back to the buyer, car back on sale.
    const holds = await this.db.query(`SELECT id FROM orders WHERE kind='reservation' AND status='reserved' AND expires_at <= now() LIMIT 100`);
    for (const r of holds) {
      let ids: string[] = [];
      await this.db.tx(async (c) => {
        const o = await this.load(r.id, c);
        if (o.status !== 'reserved' || new Date(o.expires_at) > new Date()) return;
        ids = await this.payments.settleInTx(c, o, 0, `hold lapsed ${o.ref}`);
        await transition(this.db, c, o.id, 'reserved', 'refunded', null, 'Reservation period ended', { expires_at: null, cancel_reason: 'hold_lapsed' });
        for (const uid of [o.buyer_id, o.seller_id]) {
          await this.notifications.notify(uid, 'lapsed', `Reservation ${o.ref} ended`,
            `The reservation of ${o.car} (${o.stock_no}) ended without a sale. The deposit is refunded to the buyer and the car is back on sale.`,
            { link: `/orders/${o.id}`, sms: true }, c);
        }
        lapsed++;
      }).catch(() => undefined);
      await this.payments.dispatch(ids);
    }
    // 3. Handed over / returned with no complaint in time; rentals the owner forgot to close.
    const due = await this.db.query(
      `SELECT id FROM orders
        WHERE (status IN ('handed_over','returned') AND auto_complete_at <= now())
           OR (kind='rental' AND status='confirmed' AND end_date + ($1 || ' hours')::interval <= now())
        LIMIT 100`,
      [String(config.autoCompleteHours)],
    );
    for (const r of due) {
      if (await this.complete(r.id, null).then(() => true, () => false)) completed++;
    }
    return { expired, lapsed, completed };
  }
}
