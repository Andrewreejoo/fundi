import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationService } from '../catalog/location.service';
import { AuthUser } from '../common/auth';
import { maskPhone } from '../common/phone';
import { addHours, addMinutes, bookingRef, formatMwk, percentOf } from '../common/util';
import { config } from '../config';
import { DbService, Queryable } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { ProvidersService } from '../providers/providers.service';
import { CreateBookingDto, QuoteDto } from './bookings.dto';
import { ACTIVE_STATUSES, BookingStatus, transition } from './state';

@Injectable()
export class BookingsService {
  constructor(
    private readonly db: DbService,
    private readonly location: LocationService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
    private readonly providers: ProvidersService,
  ) {}

  /** Fees are fixed when the price is agreed (accept or accept-quote). */
  private fees(price: number, escrow: boolean) {
    if (!escrow) return { protection_fee_mwk: 0, commission_mwk: 0 };
    return {
      protection_fee_mwk: Math.max(config.protectionFeeMin, percentOf(price, config.protectionFeePercent)),
      commission_mwk: percentOf(price, config.commissionPercent),
    };
  }

  // ---------------------------------------------------------------- create

  async create(customer: AuthUser, dto: CreateBookingDto) {
    if (dto.providerId === customer.id) throw new BadRequestException('You cannot book yourself');
    const provider = await this.db.one(
      `SELECT p.user_id, p.display_name, p.status, u.status AS user_status FROM provider_profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`,
      [dto.providerId],
    );
    if (!provider || provider.status !== 'active' || provider.user_status !== 'active') {
      throw new BadRequestException('This fundi is not taking bookings right now');
    }
    let listing: any = null;
    let categoryId = dto.categoryId;
    if (dto.listingId) {
      listing = await this.db.one(`SELECT * FROM listings WHERE id=$1 AND provider_id=$2 AND status='live'`, [dto.listingId, dto.providerId]);
      if (!listing) throw new BadRequestException('That service is no longer available');
      categoryId = listing.category_id;
    }
    if (!categoryId) throw new BadRequestException('Choose a service or a trade');
    const trade = await this.db.one('SELECT 1 FROM provider_trades WHERE provider_id=$1 AND category_id=$2', [dto.providerId, categoryId]);
    if (!trade) throw new BadRequestException('This fundi does not offer that trade');
    if (dto.scheduledFor && new Date(dto.scheduledFor) < new Date(new Date().toISOString().slice(0, 10))) {
      throw new BadRequestException('Choose today or a later date');
    }
    const active = await this.db.one<{ n: number }>(
      `SELECT count(*) AS n FROM bookings WHERE customer_id=$1 AND status = ANY($2::text[])`,
      [customer.id, ['requested', 'quoted']],
    );
    if (active!.n >= 10) throw new BadRequestException('You have too many open requests. Wait for replies first.');

    const loc = await this.location.resolve(dto);
    const type = listing?.price_type === 'fixed' ? 'instant' : 'quote';
    const price: number | null = type === 'instant' ? listing.price_mwk : null;
    const escrow = dto.escrow ?? (price === null || price >= config.escrowDefaultMin);
    const expires = addHours(new Date(), type === 'instant' ? config.instantReplyHours : config.quoteReplyHours);

    return this.db.tx(async (c) => {
      let ref = bookingRef();
      while (await this.db.one('SELECT 1 FROM bookings WHERE ref=$1', [ref], c)) ref = bookingRef();
      const b = await this.db.one(
        `INSERT INTO bookings (ref, customer_id, provider_id, listing_id, category_id, type, status, description, photo_ids,
                               scheduled_for, time_slot, landmark, location, price_mwk, escrow, expires_at, channel)
         VALUES ($1,$2,$3,$4,$5,$6,'requested',$7,$8,$9,$10,$11, ST_MakePoint($13,$12)::geography, $14,$15,$16,$17) RETURNING id`,
        [
          ref, customer.id, dto.providerId, listing?.id ?? null, categoryId, type, dto.description ?? null, dto.photoIds ?? [],
          dto.scheduledFor ?? null, dto.timeSlot ?? null, loc.landmark ?? `${loc.area}, ${loc.district}`, loc.lat, loc.lng,
          price, escrow, expires, dto.channel ?? 'app',
        ],
        c,
      );
      await this.db.query(`INSERT INTO booking_events (booking_id, to_status, actor_id) VALUES ($1,'requested',$2)`, [b.id, customer.id], c);
      const what = listing?.title ?? 'a job';
      await this.notifications.notify(
        dto.providerId, 'new_request', type === 'instant' ? 'Ntchito yatsopano' : 'Quote request',
        type === 'instant'
          ? `New booking ${ref}: ${what} in ${loc.area} for ${formatMwk(price!)}. Accept within ${config.instantReplyHours} h in the Fundi app.`
          : `Quote request ${ref}: ${what} in ${loc.area}. Send your price within ${config.quoteReplyHours} h in the Fundi app.`,
        { bookingId: b.id, sms: true }, c,
      );
      return this.detail(b.id, customer, c);
    });
  }

  // ---------------------------------------------------------------- read

  async list(user: AuthUser, as: 'customer' | 'provider', scope: 'active' | 'past' | 'all') {
    const col = as === 'provider' ? 'b.provider_id' : 'b.customer_id';
    const statusFilter =
      scope === 'active' ? `AND b.status = ANY($2::text[])` : scope === 'past' ? `AND NOT (b.status = ANY($2::text[]))` : `AND $2::text[] IS NOT NULL`;
    return this.db.query(
      `SELECT b.id, b.ref, b.type, b.status, b.price_mwk, b.protection_fee_mwk, b.escrow, b.scheduled_for, b.time_slot,
              b.landmark, b.expires_at, b.auto_confirm_at, b.created_at, b.description,
              c.slug AS category_slug, c.name_en AS category_name_en, c.name_ny AS category_name_ny,
              l.title AS listing_title, p.display_name AS provider_name, COALESCE(cu.name, 'Customer') AS customer_name
         FROM bookings b
         JOIN categories c ON c.id=b.category_id
         JOIN provider_profiles p ON p.user_id=b.provider_id
         JOIN users cu ON cu.id=b.customer_id
         LEFT JOIN listings l ON l.id=b.listing_id
        WHERE ${col} = $1 ${statusFilter}
        ORDER BY b.created_at DESC LIMIT 100`,
      [user.id, ACTIVE_STATUSES],
    );
  }

  async detail(id: string, user: AuthUser, client?: Queryable) {
    const b = await this.db.one(
      `SELECT b.id, b.ref, b.customer_id, b.provider_id, b.listing_id, b.category_id, b.type, b.status, b.description, b.photo_ids,
              b.scheduled_for, b.time_slot, b.landmark, ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
              b.price_mwk, b.quote_note, b.escrow, b.protection_fee_mwk, b.commission_mwk, b.expires_at, b.auto_confirm_at,
              b.completed_at, b.confirmed_at, b.cancel_reason, b.channel, b.created_at,
              c.slug AS category_slug, c.name_en AS category_name_en, c.name_ny AS category_name_ny,
              l.title AS listing_title, p.display_name AS provider_name, p.verification_level AS provider_level,
              pu.phone AS provider_phone, cu.phone AS customer_phone, COALESCE(cu.name, 'Customer') AS customer_name
         FROM bookings b
         JOIN categories c ON c.id=b.category_id
         JOIN provider_profiles p ON p.user_id=b.provider_id
         JOIN users pu ON pu.id=b.provider_id
         JOIN users cu ON cu.id=b.customer_id
         LEFT JOIN listings l ON l.id=b.listing_id
        WHERE b.id=$1`,
      [id],
      client,
    );
    if (!b) throw new NotFoundException('Booking not found');
    const isCustomer = b.customer_id === user.id;
    const isProvider = b.provider_id === user.id;
    if (!isCustomer && !isProvider && !user.roles.includes('admin')) throw new NotFoundException('Booking not found');

    // Phone numbers are revealed to the other party only once the booking is agreed (spec 2.5).
    const revealed = !['requested', 'quoted', 'cancelled', 'expired'].includes(b.status) || user.roles.includes('admin');
    if (!revealed) {
      b.provider_phone = isProvider ? b.provider_phone : maskPhone(b.provider_phone);
      b.customer_phone = isCustomer ? b.customer_phone : maskPhone(b.customer_phone);
    }
    // Sequential on purpose: a transaction client cannot run queries in parallel.
    const events = await this.db.query(`SELECT from_status, to_status, note, at FROM booking_events WHERE booking_id=$1 ORDER BY at, id`, [id], client);
    const payments = await this.db.query(
      `SELECT id, direction, operator, amount_mwk, status, failure_reason, created_at, updated_at FROM payments
        WHERE booking_id=$1 ${user.roles.includes('admin') ? '' : isProvider ? `AND direction='payout'` : `AND direction <> 'payout'`} ORDER BY created_at`,
      [id],
      client,
    );
    const review = await this.db.one(`SELECT id, rating, text, provider_reply, created_at FROM reviews WHERE booking_id=$1`, [id], client);
    const dispute = await this.db.one(`SELECT id, reason, status, resolution, provider_share_percent, admin_note, sla_due_at, created_at, resolved_at FROM disputes WHERE booking_id=$1`, [id], client);
    const total = b.price_mwk ? b.price_mwk + b.protection_fee_mwk : null;
    return {
      ...b,
      total_mwk: total,
      provider_net_mwk: b.price_mwk ? b.price_mwk - b.commission_mwk : null,
      role: isCustomer ? 'customer' : isProvider ? 'provider' : 'admin',
      actions: this.actionsFor(b.status, b.escrow, isCustomer, isProvider, !!review),
      events, payments, review, dispute,
    };
  }

  /** What the caller may do next. Clients render buttons from this, so rules stay server-side. */
  private actionsFor(status: BookingStatus, escrow: boolean, isCustomer: boolean, isProvider: boolean, reviewed: boolean) {
    const a: string[] = [];
    if (isProvider) {
      if (status === 'requested') a.push('accept_or_quote', 'decline');
      if (status === 'accepted' && !escrow) a.push('start', 'complete');
      if (status === 'paid') a.push('start', 'complete', 'cancel');
      if (status === 'in_progress') a.push('complete');
      if (['paid', 'in_progress', 'completed'].includes(status)) a.push('dispute');
    }
    if (isCustomer) {
      if (status === 'quoted') a.push('accept_quote');
      if (status === 'accepted' && escrow) a.push('pay');
      if (['requested', 'quoted', 'accepted'].includes(status)) a.push('cancel');
      if (status === 'completed') a.push('confirm');
      if (['paid', 'in_progress', 'completed'].includes(status) && escrow) a.push('dispute');
      if (status === 'completed' && !escrow) a.push('dispute');
      if (status === 'confirmed' && !reviewed) a.push('review');
    }
    return a;
  }

  private async load(id: string, c: Queryable) {
    const b = await this.db.one(`SELECT * FROM bookings WHERE id=$1 FOR UPDATE`, [id], c);
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }
  private mustBeProvider(b: any, user: AuthUser) {
    if (b.provider_id !== user.id) throw new ForbiddenException('Only the fundi can do this');
  }
  private mustBeCustomer(b: any, user: AuthUser) {
    if (b.customer_id !== user.id) throw new ForbiddenException('Only the customer can do this');
  }

  // ---------------------------------------------------------------- provider actions

  async accept(id: string, user: AuthUser) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeProvider(b, user);
      if (b.status !== 'requested' || b.type !== 'instant') throw new BadRequestException('Only new fixed-price bookings can be accepted. For quotes, send a price.');
      await transition(this.db, c, id, 'requested', 'accepted', user.id, null, {
        ...this.fees(b.price_mwk, b.escrow),
        expires_at: b.escrow ? addMinutes(new Date(), config.payWindowMinutes) : null,
      });
      await this.notifications.notify(b.customer_id, 'accepted', 'Booking accepted',
        b.escrow
          ? `Your booking ${b.ref} was accepted. Pay within ${config.payWindowMinutes} minutes in the Fundi app to confirm it.`
          : `Your booking ${b.ref} was accepted. Pay the fundi directly when the job is done.`,
        { bookingId: id, sms: true }, c);
    });
    return this.detail(id, user);
  }

  async quote(id: string, user: AuthUser, dto: QuoteDto) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeProvider(b, user);
      if (b.status !== 'requested' || b.type !== 'quote') throw new BadRequestException('This booking is not waiting for a quote');
      await transition(this.db, c, id, 'requested', 'quoted', user.id, dto.note, {
        price_mwk: dto.priceMwk,
        quote_note: dto.note ?? null,
        expires_at: addHours(new Date(), config.quoteReplyHours),
      });
      await this.notifications.notify(b.customer_id, 'quoted', 'Mtengo wafika',
        `Quote for ${b.ref}: ${formatMwk(dto.priceMwk)}. Accept it in the Fundi app within ${config.quoteReplyHours} h.`,
        { bookingId: id, sms: true }, c);
    });
    return this.detail(id, user);
  }

  async decline(id: string, user: AuthUser, reason?: string) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeProvider(b, user);
      if (b.status !== 'requested') throw new BadRequestException('Only new requests can be declined');
      await transition(this.db, c, id, 'requested', 'cancelled', user.id, reason, { cancel_reason: 'declined_by_provider', expires_at: null });
      await this.notifications.notify(b.customer_id, 'declined', 'Fundi is not available',
        `The fundi could not take ${b.ref}. Open the Fundi app to see other fundis nearby.`, { bookingId: id, sms: true }, c);
    });
    return this.detail(id, user);
  }

  async start(id: string, user: AuthUser) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeProvider(b, user);
      const from: BookingStatus = b.escrow ? 'paid' : 'accepted';
      if (b.status !== from) throw new BadRequestException(b.escrow ? 'Wait until the customer has paid' : 'Booking is not ready to start');
      await transition(this.db, c, id, from, 'in_progress', user.id, null, { expires_at: null });
    });
    return this.detail(id, user);
  }

  async complete(id: string, user: AuthUser) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeProvider(b, user);
      const allowed: BookingStatus[] = b.escrow ? ['paid', 'in_progress'] : ['accepted', 'in_progress'];
      if (!allowed.includes(b.status)) throw new BadRequestException(b.escrow && b.status === 'accepted' ? 'Wait until the customer has paid' : 'This job cannot be marked done now');
      await transition(this.db, c, id, allowed, 'completed', user.id, null, {
        completed_at: new Date(),
        auto_confirm_at: addHours(new Date(), config.autoConfirmHours),
        expires_at: null,
      });
      await this.notifications.notify(b.customer_id, 'completed', 'Ntchito yatha?',
        b.escrow
          ? `The fundi marked ${b.ref} as done. Confirm in the Fundi app to release payment, or report a problem within ${config.autoConfirmHours} h.`
          : `The fundi marked ${b.ref} as done. Confirm in the Fundi app and rate the work.`,
        { bookingId: id, sms: true }, c);
    });
    return this.detail(id, user);
  }

  // ---------------------------------------------------------------- customer actions

  async acceptQuote(id: string, user: AuthUser) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeCustomer(b, user);
      if (b.status !== 'quoted') throw new BadRequestException('There is no quote to accept');
      await transition(this.db, c, id, 'quoted', 'accepted', user.id, null, {
        ...this.fees(b.price_mwk, b.escrow),
        expires_at: b.escrow ? addMinutes(new Date(), config.payWindowMinutes) : null,
      });
      await this.notifications.notify(b.provider_id, 'quote_accepted', 'Quote accepted',
        b.escrow ? `Your quote for ${b.ref} was accepted. We will tell you when the customer has paid.` : `Your quote for ${b.ref} was accepted. The customer will pay you directly.`,
        { bookingId: id, sms: true }, c);
    });
    return this.detail(id, user);
  }

  pay(id: string, user: AuthUser, phone?: string) {
    return this.payments.startCollect(id, user.id, phone);
  }

  async cancel(id: string, user: AuthUser, reason?: string) {
    let dispatchIds: string[] = [];
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      const isCustomer = b.customer_id === user.id;
      const isProvider = b.provider_id === user.id;
      if (!isCustomer && !isProvider) throw new NotFoundException('Booking not found');
      if (['requested', 'quoted', 'accepted'].includes(b.status)) {
        await transition(this.db, c, id, b.status, 'cancelled', user.id, reason, {
          cancel_reason: isCustomer ? 'cancelled_by_customer' : 'cancelled_by_provider', expires_at: null,
        });
      } else if (b.status === 'paid' && isProvider) {
        // Provider backs out after payment: full refund including the protection fee.
        dispatchIds = await this.payments.settleInTx(c, b, 0, true);
        await transition(this.db, c, id, 'paid', 'refunded', user.id, reason, { cancel_reason: 'cancelled_by_provider_after_payment' });
      } else {
        throw new BadRequestException(isCustomer && b.status === 'paid' ? 'This booking is paid. Report a problem instead and we will help.' : 'This booking can no longer be cancelled');
      }
      const other = isCustomer ? b.provider_id : b.customer_id;
      await this.notifications.notify(other, 'cancelled', 'Booking cancelled',
        `Booking ${b.ref} was cancelled${dispatchIds.length ? '. Your money is being refunded.' : '.'}`, { bookingId: id, sms: true }, c);
    });
    await this.payments.dispatch(dispatchIds);
    return this.detail(id, user);
  }

  async confirm(id: string, user: AuthUser | null) {
    let dispatchIds: string[] = [];
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      if (user) this.mustBeCustomer(b, user);
      if (b.status !== 'completed') throw new BadRequestException('The fundi has not marked this job as done yet');
      if (b.escrow) dispatchIds = await this.payments.settleInTx(c, b, 100, false);
      await transition(this.db, c, id, 'completed', 'confirmed', user?.id ?? null, user ? null : 'Auto-confirmed: no reply within the window', {
        confirmed_at: new Date(), auto_confirm_at: null,
      });
      await this.db.query(`UPDATE provider_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id=$1`, [b.provider_id], c);
      await this.providers.recomputeTrust(b.provider_id, c);
      await this.notifications.notify(b.provider_id, 'confirmed', 'Job confirmed',
        b.escrow ? `${b.ref} confirmed. ${formatMwk(b.price_mwk - b.commission_mwk)} is on its way to your wallet.` : `${b.ref} confirmed. Thank you!`,
        { bookingId: id, sms: true }, c);
      await this.notifications.notify(b.customer_id, 'rate', 'Rate your fundi',
        `How was the work on ${b.ref}? Rate it from 1 to 5 in the Fundi app.`, { bookingId: id, sms: true }, c);
    });
    await this.payments.dispatch(dispatchIds);
    return user ? this.detail(id, user) : null;
  }

  async dispute(id: string, user: AuthUser, reason: string) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      const isCustomer = b.customer_id === user.id;
      if (!isCustomer && b.provider_id !== user.id) throw new NotFoundException('Booking not found');
      const allowed: BookingStatus[] = b.escrow ? ['paid', 'in_progress', 'completed'] : ['completed'];
      if (!allowed.includes(b.status)) throw new BadRequestException('A problem can only be reported on a paid or finished job');
      await transition(this.db, c, id, b.status, 'disputed', user.id, reason, { auto_confirm_at: null });
      await this.db.query(
        `INSERT INTO disputes (booking_id, opened_by, reason, sla_due_at) VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval)`,
        [id, user.id, reason, String(config.disputeSlaHours)],
        c,
      );
      const other = isCustomer ? b.provider_id : b.customer_id;
      for (const uid of [user.id, other]) {
        await this.notifications.notify(uid, 'disputed', 'Problem reported',
          `A problem was reported on ${b.ref}. ${b.escrow ? 'The money stays held. ' : ''}Fundi support will call both of you within ${config.disputeSlaHours} h.`,
          { bookingId: id, sms: true }, c);
      }
    });
    return this.detail(id, user);
  }

  async review(id: string, user: AuthUser, rating: number, text?: string) {
    await this.db.tx(async (c) => {
      const b = await this.load(id, c);
      this.mustBeCustomer(b, user);
      if (b.status !== 'confirmed') throw new BadRequestException('You can rate after confirming the job');
      const exists = await this.db.one('SELECT 1 FROM reviews WHERE booking_id=$1', [id], c);
      if (exists) throw new BadRequestException('You already rated this job');
      await this.db.query(
        `INSERT INTO reviews (booking_id, provider_id, customer_id, rating, text) VALUES ($1,$2,$3,$4,$5)`,
        [id, b.provider_id, user.id, rating, text ?? null],
        c,
      );
      await this.db.query(
        `UPDATE provider_profiles SET rating_sum = rating_sum + $2, rating_count = rating_count + 1, updated_at=now() WHERE user_id=$1`,
        [b.provider_id, rating],
        c,
      );
      await this.providers.recomputeTrust(b.provider_id, c);
    });
    return this.detail(id, user);
  }

  async reply(reviewId: string, user: AuthUser, reply: string) {
    const r = await this.db.one(
      `UPDATE reviews SET provider_reply=$3 WHERE id=$1 AND provider_id=$2 AND provider_reply IS NULL RETURNING id, rating, text, provider_reply`,
      [reviewId, user.id, reply],
    );
    if (!r) throw new BadRequestException('You can reply once to reviews of your own work');
    return r;
  }

  // ---------------------------------------------------------------- timers (called by the scheduler)

  async sweep() {
    const now = new Date();
    const expiring = await this.db.query(
      `SELECT id, status, escrow FROM bookings WHERE status IN ('requested','quoted','accepted') AND expires_at IS NOT NULL AND expires_at <= $1 LIMIT 200`,
      [now],
    );
    for (const b of expiring) {
      await this.db.tx(async (c) => {
        const cur = await this.load(b.id, c);
        if (cur.status !== b.status || !cur.expires_at || cur.expires_at > now) return;
        const to = cur.status === 'accepted' ? 'cancelled' : 'expired';
        const note = cur.status === 'accepted' ? 'Not paid in time' : 'No reply in time';
        await transition(this.db, c, cur.id, cur.status, to, null, note, { expires_at: null, cancel_reason: to === 'cancelled' ? 'not_paid' : null });
        await this.notifications.notify(cur.customer_id, to, to === 'expired' ? 'No reply yet' : 'Booking cancelled',
          to === 'expired'
            ? `The fundi did not reply to ${cur.ref} in time. Open the Fundi app to see other fundis nearby.`
            : `Booking ${cur.ref} was cancelled because payment was not received in time.`,
          { bookingId: cur.id, sms: true }, c);
        if (to === 'cancelled') {
          await this.notifications.notify(cur.provider_id, 'cancelled', 'Booking cancelled',
            `Booking ${cur.ref} was cancelled: the customer did not pay in time.`, { bookingId: cur.id }, c);
        }
      });
    }
    const autoConfirm = await this.db.query(
      `SELECT id FROM bookings WHERE status='completed' AND auto_confirm_at IS NOT NULL AND auto_confirm_at <= $1 LIMIT 100`,
      [now],
    );
    for (const b of autoConfirm) await this.confirm(b.id, null).catch(() => undefined);
    return { expired: expiring.length, autoConfirmed: autoConfirm.length };
  }
}
