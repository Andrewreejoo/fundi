import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationService } from '../catalog/location.service';
import { normalizeMwPhone, operatorFor } from '../common/phone';
import { config } from '../config';
import { DbService, Queryable } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BecomeProviderDto, ListingDto, SearchDto, UpdateListingDto, UpdateProviderDto, VerificationDto } from './providers.dto';

/** Words that send a listing to manual review even for verified providers. Extend from the admin later. */
const REVIEW_WORDS = /\b(whatsapp only|pay first|send money|deposit to|loan|bitcoin|crypto)\b/i;

/** Public provider card columns. Phone numbers are never included in public payloads. */
const PROVIDER_COLUMNS = `
  p.user_id AS id, p.display_name, p.bio, p.years_experience, p.avatar_file_id, p.verification_level, p.badges,
  p.rating_count, CASE WHEN p.rating_count > 0 THEN round(p.rating_sum::numeric / p.rating_count, 1) END AS rating,
  p.jobs_completed, p.available_today, p.home_visits, p.work_hours, p.service_radius_km,
  p.district, p.area, p.landmark, p.status`;

@Injectable()
export class ProvidersService {
  constructor(
    private readonly db: DbService,
    private readonly location: LocationService,
    private readonly notifications: NotificationsService,
  ) {}

  private async categoryIds(trades: (string | number)[], client?: Queryable): Promise<number[]> {
    const ids = trades.filter((t) => typeof t === 'number' || /^\d+$/.test(String(t))).map(Number);
    const slugs = trades.filter((t) => !(typeof t === 'number' || /^\d+$/.test(String(t)))).map(String);
    const rows = await this.db.query<{ id: number }>(
      `SELECT id FROM categories WHERE active AND (id = ANY($1::int[]) OR slug = ANY($2::text[]))`,
      [ids, slugs],
      client,
    );
    if (rows.length !== new Set(trades.map(String)).size) throw new BadRequestException('Unknown trade in list');
    return rows.map((r) => r.id);
  }

  private payout(phoneInput: string) {
    const phone = normalizeMwPhone(phoneInput);
    if (!phone) throw new BadRequestException('Payout number must be an Airtel or TNM number');
    return { msisdn: phone, operator: operatorFor(phone)! };
  }

  /** Create a provider profile for the caller, or (field agent) for another phone number. */
  async become(actor: { id: string; phone: string; roles: string[] }, dto: BecomeProviderDto) {
    return this.db.tx(async (c) => {
      let userId = actor.id;
      let phone = actor.phone;
      if (dto.forPhone) {
        if (!actor.roles.includes('agent') && !actor.roles.includes('admin')) throw new ForbiddenException('Only field agents can register others');
        const p = normalizeMwPhone(dto.forPhone);
        if (!p) throw new BadRequestException('Invalid phone number');
        const u = await this.db.one(
          `INSERT INTO users (phone, name) VALUES ($1,$2) ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id`,
          [p, dto.displayName],
          c,
        );
        userId = u.id;
        phone = p;
      }
      const existing = await this.db.one('SELECT 1 FROM provider_profiles WHERE user_id=$1', [userId], c);
      if (existing) throw new BadRequestException('You are already registered as a fundi');

      const loc = await this.location.resolve(dto, c);
      const payout = this.payout(dto.payoutPhone ?? phone);
      const trades = await this.categoryIds(dto.trades, c);
      await this.db.query(
        `INSERT INTO provider_profiles (user_id, display_name, bio, years_experience, avatar_file_id, payout_msisdn, payout_operator,
            home_visits, work_hours, service_radius_km, location, district, area, landmark, onboarded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ST_MakePoint($12,$11)::geography, $13,$14,$15,$16)`,
        [
          userId, dto.displayName, dto.bio ?? null, dto.yearsExperience ?? null, dto.avatarFileId ?? null,
          payout.msisdn, payout.operator, dto.homeVisits ?? true, dto.workHours ?? null, dto.serviceRadiusKm ?? 15,
          loc.lat, loc.lng, loc.district, loc.area, loc.landmark, dto.forPhone ? actor.id : null,
        ],
        c,
      );
      for (const cid of trades) {
        await this.db.query('INSERT INTO provider_trades (provider_id, category_id) VALUES ($1,$2)', [userId, cid], c);
      }
      await this.db.query(
        `UPDATE users SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || '{provider}'::text[]) r),
                          name = COALESCE(name, $2), updated_at = now() WHERE id=$1`,
        [userId, dto.displayName],
        c,
      );
      await this.db.audit(actor.id, 'provider.create', 'provider', userId, { agent: !!dto.forPhone }, c);
      await this.notifications.notify(
        userId, 'welcome', 'Takulandirani ku Fundi',
        'You are now listed on Fundi. Add a service with photos and verify your ID to rank higher.',
        { sms: true }, c,
      );
      return this.mine(userId, c);
    });
  }

  async update(userId: string, dto: UpdateProviderDto) {
    return this.db.tx(async (c) => {
      const prof = await this.db.one('SELECT user_id FROM provider_profiles WHERE user_id=$1', [userId], c);
      if (!prof) throw new NotFoundException('Register as a fundi first');
      const sets: string[] = [];
      const vals: unknown[] = [userId];
      const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
      if (dto.displayName !== undefined) set('display_name', dto.displayName);
      if (dto.bio !== undefined) set('bio', dto.bio);
      if (dto.yearsExperience !== undefined) set('years_experience', dto.yearsExperience);
      if (dto.homeVisits !== undefined) set('home_visits', dto.homeVisits);
      if (dto.availableToday !== undefined) set('available_today', dto.availableToday);
      if (dto.workHours !== undefined) set('work_hours', dto.workHours);
      if (dto.serviceRadiusKm !== undefined) set('service_radius_km', dto.serviceRadiusKm);
      if (dto.avatarFileId !== undefined) set('avatar_file_id', dto.avatarFileId);
      if (dto.status !== undefined) set('status', dto.status);
      if (dto.payoutPhone !== undefined) {
        const p = this.payout(dto.payoutPhone);
        set('payout_msisdn', p.msisdn);
        set('payout_operator', p.operator);
      }
      if (dto.placeId !== undefined || dto.lat !== undefined) {
        const loc = await this.location.resolve(dto, c);
        vals.push(loc.lng, loc.lat);
        sets.push(`location = ST_MakePoint($${vals.length - 1}, $${vals.length})::geography`);
        set('district', loc.district);
        set('area', loc.area);
        set('landmark', loc.landmark);
      } else if (dto.landmark !== undefined) set('landmark', dto.landmark);
      if (sets.length) {
        await this.db.query(`UPDATE provider_profiles SET ${sets.join(', ')}, updated_at = now() WHERE user_id = $1`, vals, c);
      }
      if (dto.trades) {
        const ids = await this.categoryIds(dto.trades, c);
        await this.db.query('DELETE FROM provider_trades WHERE provider_id=$1', [userId], c);
        for (const cid of ids) await this.db.query('INSERT INTO provider_trades VALUES ($1,$2)', [userId, cid], c);
      }
      return this.mine(userId, c);
    });
  }

  /** The provider's own view: profile, trades, all listings, payout details, earnings summary. */
  async mine(userId: string, client?: Queryable) {
    const profile = await this.db.one(
      `SELECT ${PROVIDER_COLUMNS}, p.payout_msisdn, p.payout_operator,
              ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng
         FROM provider_profiles p WHERE p.user_id=$1`,
      [userId],
      client,
    );
    if (!profile) throw new NotFoundException('Register as a fundi first');
    const trades = await this.db.query(`SELECT c.id, c.slug, c.name_en, c.name_ny, c.icon FROM provider_trades t JOIN categories c ON c.id=t.category_id WHERE t.provider_id=$1`, [userId], client);
    const listings = await this.db.query(`SELECT id, category_id, title, description, price_type, price_mwk, photo_ids, status, reject_reason, created_at FROM listings WHERE provider_id=$1 ORDER BY created_at`, [userId], client);
    const verification = await this.db.one(`SELECT id, status, reason, created_at FROM verification_requests WHERE provider_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId], client);
    const earnings = await this.earnings(userId, client);
    return { ...profile, trades, listings, verification, earnings };
  }

  async earnings(userId: string, client?: Queryable) {
    const row = await this.db.one(
      `SELECT
         COALESCE((SELECT sum(p.amount_mwk) FROM payments p JOIN bookings b ON b.id=p.booking_id
                    WHERE b.provider_id=$1 AND p.direction='payout' AND p.status='success'
                      AND p.updated_at > now() - interval '7 days'), 0) AS paid_7d,
         COALESCE((SELECT sum(p.amount_mwk) FROM payments p JOIN bookings b ON b.id=p.booking_id
                    WHERE b.provider_id=$1 AND p.direction='payout' AND p.status='success'), 0) AS paid_total,
         COALESCE((SELECT sum(b.price_mwk) FROM bookings b
                    WHERE b.provider_id=$1 AND b.escrow AND b.status IN ('paid','in_progress','completed','disputed')), 0) AS held_in_escrow,
         COALESCE((SELECT sum(p.amount_mwk) FROM payments p JOIN bookings b ON b.id=p.booking_id
                    WHERE b.provider_id=$1 AND p.direction='payout' AND p.status='pending'), 0) AS payouts_pending`,
      [userId],
      client,
    );
    return row;
  }

  // ---------- Listings ----------

  async createListing(userId: string, dto: ListingDto) {
    const prof = await this.db.one('SELECT verification_level FROM provider_profiles WHERE user_id=$1', [userId]);
    if (!prof) throw new NotFoundException('Register as a fundi first');
    const cat = await this.db.one<{ id: number }>(
      `SELECT c.id FROM categories c JOIN provider_trades t ON t.category_id=c.id AND t.provider_id=$1
        WHERE c.id = $2 OR c.slug = $3`,
      [userId, dto.categoryId ?? null, dto.categorySlug ?? null],
    );
    if (!cat) throw new BadRequestException('Choose one of your own trades for this service');
    if (dto.priceType !== 'quote' && !dto.priceMwk) throw new BadRequestException('Enter a price, or choose "ask for a quote"');
    await this.assertOwnFiles(userId, dto.photoIds ?? []);
    const status = this.autoStatus(prof.verification_level, `${dto.title} ${dto.description ?? ''}`);
    const row = await this.db.one(
      `INSERT INTO listings (provider_id, category_id, title, description, price_type, price_mwk, photo_ids, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [userId, cat.id, dto.title, dto.description ?? null, dto.priceType, dto.priceType === 'quote' ? null : dto.priceMwk, dto.photoIds ?? [], status],
    );
    return row;
  }

  async updateListing(userId: string, id: string, dto: UpdateListingDto) {
    const l = await this.db.one('SELECT * FROM listings WHERE id=$1 AND provider_id=$2', [id, userId]);
    if (!l) throw new NotFoundException('Listing not found');
    const prof = await this.db.one('SELECT verification_level FROM provider_profiles WHERE user_id=$1', [userId]);
    if (dto.photoIds) await this.assertOwnFiles(userId, dto.photoIds);
    const priceType = dto.priceType ?? l.price_type;
    const price = priceType === 'quote' ? null : dto.priceMwk ?? l.price_mwk;
    if (priceType !== 'quote' && !price) throw new BadRequestException('Enter a price');
    const contentChanged = dto.title !== undefined || dto.description !== undefined || dto.photoIds !== undefined;
    let status = dto.status ?? l.status;
    if (l.status === 'rejected' || contentChanged) {
      status = this.autoStatus(prof.verification_level, `${dto.title ?? l.title} ${dto.description ?? l.description ?? ''}`);
      if (status === 'live' && dto.status === 'paused') status = 'paused';
    }
    if (status === 'live' && l.status === 'pending' && !contentChanged) status = 'pending'; // cannot self-approve
    return this.db.one(
      `UPDATE listings SET title=$3, description=$4, price_type=$5, price_mwk=$6, photo_ids=$7, status=$8,
              reject_reason = CASE WHEN $8 = 'rejected' THEN reject_reason ELSE NULL END, updated_at=now()
        WHERE id=$1 AND provider_id=$2 RETURNING *`,
      [id, userId, dto.title ?? l.title, dto.description ?? l.description, priceType, price, dto.photoIds ?? l.photo_ids, status],
    );
  }

  /** Verified providers with clean text go live at once; everyone else waits for an admin. */
  private autoStatus(level: string, text: string) {
    return level !== 'basic' && !REVIEW_WORDS.test(text) ? 'live' : 'pending';
  }

  private async assertOwnFiles(userId: string, ids: string[]) {
    if (!ids.length) return;
    const rows = await this.db.query('SELECT id FROM files WHERE id = ANY($1::uuid[]) AND owner_id=$2 AND NOT private', [ids, userId]);
    if (rows.length !== new Set(ids).size) throw new BadRequestException('Some photos were not found');
  }

  // ---------- Verification ----------

  async requestVerification(userId: string, dto: VerificationDto) {
    const prof = await this.db.one('SELECT verification_level FROM provider_profiles WHERE user_id=$1', [userId]);
    if (!prof) throw new NotFoundException('Register as a fundi first');
    if (prof.verification_level !== 'basic') throw new BadRequestException('Your ID is already verified');
    const pending = await this.db.one(`SELECT 1 FROM verification_requests WHERE provider_id=$1 AND status='pending'`, [userId]);
    if (pending) throw new BadRequestException('Your ID is already being checked');
    const files = await this.db.query(
      `SELECT id FROM files WHERE id = ANY($1::uuid[]) AND owner_id=$2 AND private`,
      [[dto.idFileId, dto.selfieFileId], userId],
    );
    if (files.length !== 2) throw new BadRequestException('Upload the ID and selfie as private files first (?private=true)');
    return this.db.one(
      `INSERT INTO verification_requests (provider_id, id_file_id, selfie_file_id) VALUES ($1,$2,$3) RETURNING id, status, created_at`,
      [userId, dto.idFileId, dto.selfieFileId],
    );
  }

  /** Award or remove the Fundi Trusted level. Rules mirror the product spec (section 2.3). */
  async recomputeTrust(providerId: string, client?: Queryable) {
    const p = await this.db.one(
      `SELECT verification_level, jobs_completed, rating_sum, rating_count,
              EXISTS (SELECT 1 FROM disputes d JOIN bookings b ON b.id=d.booking_id
                       WHERE b.provider_id=$1 AND d.status='resolved' AND d.resolved_at > now() - interval '90 days'
                         AND (d.resolution='refund' OR (d.resolution='split' AND d.provider_share_percent < 100))) AS upheld_dispute
         FROM provider_profiles WHERE user_id=$1`,
      [providerId],
      client,
    );
    if (!p || p.verification_level === 'basic') return;
    const avg = p.rating_count ? p.rating_sum / p.rating_count : 0;
    const trusted = p.jobs_completed >= 10 && avg >= 4.5 && !p.upheld_dispute;
    const next = trusted ? 'trusted' : 'id_verified';
    if (next !== p.verification_level) {
      await this.db.query(`UPDATE provider_profiles SET verification_level=$2, updated_at=now() WHERE user_id=$1`, [providerId, next], client);
    }
  }

  // ---------- Public ----------

  async search(dto: SearchDto) {
    let lat = dto.lat;
    let lng = dto.lng;
    if (dto.placeId) {
      const p = await this.db.one('SELECT ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng FROM places WHERE id=$1', [dto.placeId]);
      if (!p) throw new BadRequestException('Unknown place');
      ({ lat, lng } = p);
    }
    if (lat === undefined || lng === undefined) throw new BadRequestException('Choose your area or share your location');
    const limit = dto.limit ?? 20;
    const offset = dto.offset ?? 0;

    // Widen 10 -> 25 -> 50 km until at least 5 providers are found (spec 2.4), unless a radius was asked for.
    const radii = dto.radiusKm ? [dto.radiusKm] : [10, 25, 50];
    let result: { rows: any[]; radiusKm: number } = { rows: [], radiusKm: radii[0] };
    for (const r of radii) {
      const rows = await this.runSearch(dto, lat, lng, r, limit, offset);
      result = { rows, radiusKm: r };
      if (rows.length >= 5 || offset > 0) break;
    }
    return { radiusKm: result.radiusKm, center: { lat, lng }, results: result.rows };
  }

  private runSearch(dto: SearchDto, lat: number, lng: number, radiusKm: number, limit: number, offset: number) {
    return this.db.query(
      `WITH cat AS (SELECT id FROM categories WHERE slug = $3 OR id::text = $3)
       SELECT ${PROVIDER_COLUMNS},
              round((ST_Distance(p.location, ST_MakePoint($2,$1)::geography) / 1000)::numeric, 1) AS distance_km,
              (SELECT min(l.price_mwk) FROM listings l
                WHERE l.provider_id=p.user_id AND l.status='live' AND l.price_type <> 'quote'
                  AND ($3::text IS NULL OR l.category_id IN (SELECT id FROM cat))) AS from_price_mwk,
              (SELECT array_agg(c.slug) FROM provider_trades t JOIN categories c ON c.id=t.category_id WHERE t.provider_id=p.user_id) AS trades,
              (
                (p.rating_sum + 4.0 * 5) / (p.rating_count + 5)
                + CASE p.verification_level WHEN 'trusted' THEN 0.6 WHEN 'id_verified' THEN 0.3 ELSE 0 END
                + CASE WHEN p.available_today THEN 0.2 ELSE 0 END
                - (ST_Distance(p.location, ST_MakePoint($2,$1)::geography) / 1000) * 0.05
              ) AS score
         FROM provider_profiles p
         JOIN users u ON u.id = p.user_id AND u.status='active'
        WHERE p.status = 'active'
          AND ST_DWithin(p.location, ST_MakePoint($2,$1)::geography, $4 * 1000)
          AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM provider_trades t WHERE t.provider_id=p.user_id AND t.category_id IN (SELECT id FROM cat)))
          AND ($5::text IS NULL OR p.display_name ILIKE '%' || $5 || '%' OR p.bio ILIKE '%' || $5 || '%'
               OR EXISTS (SELECT 1 FROM listings l WHERE l.provider_id=p.user_id AND l.status='live' AND l.title ILIKE '%' || $5 || '%'))
          AND (NOT $6 OR p.verification_level <> 'basic')
          AND (NOT $7 OR p.available_today)
          AND (NOT $8 OR p.home_visits)
          AND ($9::int IS NULL OR EXISTS (SELECT 1 FROM listings l WHERE l.provider_id=p.user_id AND l.status='live'
                                           AND (l.price_type='quote' OR l.price_mwk <= $9)))
        ORDER BY score DESC, distance_km ASC
        LIMIT $10 OFFSET $11`,
      [
        lat, lng, dto.category ?? null, radiusKm, dto.q?.trim() || null,
        dto.verifiedOnly === 'true', dto.availableToday === 'true', dto.homeVisit === 'true',
        dto.maxPrice ?? null, limit, offset,
      ],
    );
  }

  async publicProfile(id: string, lat?: number, lng?: number) {
    const p = await this.db.one(
      `SELECT ${PROVIDER_COLUMNS},
              CASE WHEN $2::float8 IS NOT NULL THEN round((ST_Distance(p.location, ST_MakePoint($3,$2)::geography)/1000)::numeric, 1) END AS distance_km
         FROM provider_profiles p JOIN users u ON u.id=p.user_id
        WHERE p.user_id=$1 AND p.status <> 'suspended' AND u.status='active'`,
      [id, lat ?? null, lng ?? null],
    );
    if (!p) throw new NotFoundException('Fundi not found');
    const [trades, listings, reviews] = await Promise.all([
      this.db.query(`SELECT c.id, c.slug, c.name_en, c.name_ny, c.icon FROM provider_trades t JOIN categories c ON c.id=t.category_id WHERE t.provider_id=$1`, [id]),
      this.db.query(`SELECT id, category_id, title, description, price_type, price_mwk, photo_ids FROM listings WHERE provider_id=$1 AND status='live' ORDER BY price_mwk NULLS LAST`, [id]),
      this.db.query(
        `SELECT r.id, r.rating, r.text, r.provider_reply, r.created_at, split_part(COALESCE(u.name,'Customer'), ' ', 1) AS customer_first_name
           FROM reviews r JOIN users u ON u.id=r.customer_id WHERE r.provider_id=$1 ORDER BY r.created_at DESC LIMIT 20`,
        [id],
      ),
    ]);
    return { ...p, trades, listings, reviews };
  }

  get minEscrow() {
    return config.escrowDefaultMin;
  }
}
