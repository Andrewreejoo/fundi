import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationService } from '../catalog/location.service';
import { AuthUser } from '../common/auth';
import { DbService, Queryable } from '../db/db.service';
import { SearchDto, UpdateVehicleDto, VehicleDto } from './vehicles.dto';

/** Columns for a stock-list card (BE FORWARD-style list row). Never includes phone numbers. */
export const CARD = `
  v.id, v.stock_no, v.purpose, v.year, v.variant, v.body_type, v.transmission, v.fuel, v.drive, v.steering,
  v.engine_cc, v.mileage_km, v.color, v.seats, v.condition, v.price_mwk, v.previous_price_mwk, v.negotiable,
  v.daily_rate_mwk, v.driver_rate_mwk, v.self_drive, v.min_days, v.district, v.area, v.status, v.featured,
  v.published_at, v.views, v.photo_ids[1] AS photo_id, cardinality(v.photo_ids) AS photo_count,
  (v.published_at > now() - interval '7 days') AS is_new,
  mk.slug AS make_slug, mk.name AS make, md.slug AS model_slug, md.name AS model,
  s.user_id AS seller_id, s.name AS seller_name, s.kind AS seller_kind, s.verified AS seller_verified`;

export const CARD_FROM = `
  FROM vehicles v
  JOIN makes mk ON mk.id = v.make_id
  JOIN models md ON md.id = v.model_id
  JOIN sellers s ON s.user_id = v.seller_id
  JOIN users su ON su.id = s.user_id`;

/** Words that send a listing back to manual review even for verified sellers. */
const REVIEW_WORDS = /\b(pay first|send money|deposit to my|western union|bitcoin|crypto|whatsapp only)\b/i;

const SORTS: Record<string, string> = {
  newest: 'v.featured DESC, v.published_at DESC NULLS LAST',
  price_asc: 'COALESCE(v.price_mwk, v.daily_rate_mwk) ASC',
  price_desc: 'COALESCE(v.price_mwk, v.daily_rate_mwk) DESC',
  year_desc: 'v.year DESC, v.published_at DESC',
  mileage_asc: 'v.mileage_km ASC NULLS LAST',
  popular: 'v.views DESC',
};

@Injectable()
export class VehiclesService {
  constructor(private readonly db: DbService, private readonly location: LocationService) {}

  // ---------------------------------------------------------------- search

  async search(q: SearchDto) {
    const purpose = q.purpose ?? 'sale';
    const where: string[] = [`v.purpose = $1`, `s.status='active'`, `su.status='active'`];
    const vals: unknown[] = [purpose];
    const add = (sql: string, v: unknown) => { vals.push(v); where.push(sql.replace(/\?/g, `$${vals.length}`)); };

    if (q.ids?.length) add('v.id = ANY(?::uuid[])', q.ids);
    else if (q.seller) { add('v.seller_id = ?', q.seller); where.push(`v.status IN ('live','reserved')`); }
    else where.push(purpose === 'sale' ? `v.status IN ('live','reserved')` : `v.status = 'live'`);
    if (q.make) add('(mk.slug = ? OR mk.id::text = ?)', q.make);
    if (q.model) add('(md.slug = ? OR md.id::text = ?)', q.model);
    if (q.body?.length) add('v.body_type = ANY(?::text[])', q.body);
    const priceCol = purpose === 'sale' ? 'v.price_mwk' : 'v.daily_rate_mwk';
    if (q.minPrice !== undefined) add(`${priceCol} >= ?`, q.minPrice);
    if (q.maxPrice !== undefined) add(`${priceCol} <= ?`, q.maxPrice);
    if (q.minYear) add('v.year >= ?', q.minYear);
    if (q.maxYear) add('v.year <= ?', q.maxYear);
    if (q.maxMileage !== undefined) add('v.mileage_km <= ?', q.maxMileage);
    if (q.transmission) add('v.transmission = ?', q.transmission);
    if (q.fuel) add('v.fuel = ?', q.fuel);
    if (q.drive) add('v.drive = ?', q.drive);
    if (q.district) add('v.district = ?', q.district);
    if (q.sellerKind) add('s.kind = ?', q.sellerKind);
    if (q.minSeats) add('v.seats >= ?', q.minSeats);
    if (q.priceDown === 'true') where.push('v.previous_price_mwk > v.price_mwk');
    if (q.withDriver === 'true') where.push('v.driver_rate_mwk IS NOT NULL');
    if (q.q?.trim()) {
      add(`(mk.name || ' ' || md.name || ' ' || COALESCE(v.variant,'') || ' ' || v.stock_no || ' ' || v.year) ILIKE '%' || ? || '%'`, q.q.trim());
    }
    if (purpose === 'rent' && q.from && q.to) {
      if (q.to <= q.from) throw new BadRequestException('Return date must be after pick-up date');
      vals.push(q.from, q.to);
      where.push(`NOT EXISTS (SELECT 1 FROM orders o WHERE o.vehicle_id=v.id AND o.kind='rental'
        AND o.status IN ('pending_payment','confirmed','handed_over','returned','disputed')
        AND daterange(o.start_date, o.end_date, '[)') && daterange($${vals.length - 1}::date, $${vals.length}::date, '[)'))`);
    }

    const perPage = q.perPage ?? 24;
    const page = q.page ?? 1;
    const whereSql = where.join(' AND ');
    const order = SORTS[q.sort ?? 'newest'] ?? SORTS.newest;
    const [rows, total, makes, bodies] = await Promise.all([
      this.db.query(
        `SELECT ${CARD} ${CARD_FROM} WHERE ${whereSql}
          ORDER BY CASE v.status WHEN 'live' THEN 0 ELSE 1 END, ${order}, v.id
          LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
        vals,
      ),
      this.db.one<{ n: number }>(`SELECT count(*) AS n ${CARD_FROM} WHERE ${whereSql}`, vals),
      // Facet counts ignore the make filter itself so the sidebar can still offer other makes.
      this.facet('mk.slug', 'mk.name', where, vals, '(mk.slug = ', 'text'),
      this.facet('v.body_type', 'v.body_type', where, vals, 'v.body_type = ANY(', 'text[]'),
    ]);
    return { purpose, total: total!.n, page, perPage, pages: Math.max(1, Math.ceil(total!.n / perPage)), results: rows, facets: { makes, bodyTypes: bodies } };
  }

  private facet(key: string, label: string, where: string[], vals: unknown[], dropPrefix: string, cast: string) {
    // The dropped clause's parameter must still be referenced, or PostgreSQL cannot type it.
    const w = where.map((x) => (x.startsWith(dropPrefix) ? `(${x.match(/\$\d+/)![0]}::${cast} IS NULL OR TRUE)` : x));
    return this.db.query(
      `SELECT ${key} AS slug, ${label} AS name, count(*) AS count ${CARD_FROM} WHERE ${w.join(' AND ')}
        GROUP BY 1, 2 ORDER BY count(*) DESC, 2 LIMIT 30`,
      vals,
    );
  }

  // ---------------------------------------------------------------- detail

  /** Accepts a uuid or a stock number (GM10023). Phone shown only to signed-in viewers. */
  async detail(idOrStock: string, viewer?: AuthUser) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(idOrStock);
    const v = await this.db.one(
      `SELECT ${CARD}, v.make_id, v.model_id, v.doors, v.plate, v.registered, v.duty_paid, v.cof_expiry, v.features,
              v.description, v.photo_ids, v.reject_reason, v.created_at, v.updated_at,
              ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng,
              s.area AS seller_area, s.district AS seller_district, s.address AS seller_address, s.created_at AS seller_since,
              s.whatsapp AS seller_whatsapp, su.phone AS seller_phone,
              (SELECT count(*) FROM vehicles x WHERE x.seller_id=s.user_id AND x.status IN ('live','reserved')) AS seller_live_count
         ${CARD_FROM} WHERE ${isUuid ? 'v.id = $1' : 'upper(v.stock_no) = upper($1)'}`,
      [idOrStock],
    );
    if (!v) throw new NotFoundException('Car not found');
    const isOwner = viewer?.id === v.seller_id;
    const isAdmin = !!viewer?.roles.includes('admin');
    if (!['live', 'reserved', 'sold'].includes(v.status) && !isOwner && !isAdmin) throw new NotFoundException('Car not found');
    if (!viewer) v.seller_phone = null; // sign in to see the number
    if (!isOwner && !isAdmin) {
      delete v.reject_reason;
      await this.db.query('UPDATE vehicles SET views = views + 1 WHERE id=$1', [v.id]);
    }
    const [similar, booked, favorite] = await Promise.all([
      this.db.query(
        `SELECT ${CARD} ${CARD_FROM}
          WHERE v.purpose=$1 AND v.status='live' AND v.id <> $2 AND (v.model_id=$3 OR v.body_type=$4)
          ORDER BY (v.model_id=$3) DESC, abs(COALESCE(v.price_mwk, v.daily_rate_mwk) - $5) LIMIT 6`,
        [v.purpose, v.id, v.model_id, v.body_type, v.price_mwk ?? v.daily_rate_mwk],
      ),
      v.purpose === 'rent' ? this.bookedRanges(v.id) : Promise.resolve([]),
      viewer ? this.db.one('SELECT 1 FROM favorites WHERE user_id=$1 AND vehicle_id=$2', [viewer.id, v.id]) : Promise.resolve(null),
    ]);
    const reservation = v.purpose === 'sale'
      ? await this.db.one(`SELECT status, expires_at FROM orders WHERE vehicle_id=$1 AND kind='reservation' AND status IN ('pending_payment','reserved','handed_over','disputed')`, [v.id])
      : null;
    return { ...v, is_owner: isOwner, is_favorite: !!favorite, similar, booked, reservation };
  }

  bookedRanges(vehicleId: string, client?: Queryable) {
    return this.db.query(
      `SELECT start_date, end_date FROM orders
        WHERE vehicle_id=$1 AND kind='rental' AND status IN ('pending_payment','confirmed','handed_over','returned','disputed')
          AND end_date >= current_date ORDER BY start_date`,
      [vehicleId],
      client,
    );
  }

  // ---------------------------------------------------------------- seller listing management

  private async model(modelId: number) {
    const m = await this.db.one('SELECT id, make_id, body_type FROM models WHERE id=$1', [modelId]);
    if (!m) throw new BadRequestException('Choose a make and model from the list');
    return m;
  }

  private async assertOwnPhotos(userId: string, ids: string[]) {
    if (!ids.length) return;
    const rows = await this.db.query('SELECT id FROM files WHERE id = ANY($1::uuid[]) AND owner_id=$2 AND NOT private', [ids, userId]);
    if (rows.length !== new Set(ids).size) throw new BadRequestException('Some photos were not found. Upload them again.');
  }

  private checkPurposeFields(purpose: string, d: { priceMwk?: number | null; dailyRateMwk?: number | null; selfDrive?: boolean; driverRateMwk?: number | null }) {
    if (purpose === 'sale' && !d.priceMwk) throw new BadRequestException('Enter the asking price');
    if (purpose === 'rent' && !d.dailyRateMwk) throw new BadRequestException('Enter the daily rental rate');
    if (purpose === 'rent' && d.selfDrive === false && d.driverRateMwk == null) {
      throw new BadRequestException('Enter the driver charge per day, or allow self-drive');
    }
  }

  async create(userId: string, dto: VehicleDto) {
    const seller = await this.db.one('SELECT verified, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, district, area FROM sellers WHERE user_id=$1 AND status=$2', [userId, 'active']);
    if (!seller) throw new ForbiddenException('Create a seller account first');
    const m = await this.model(dto.modelId);
    this.checkPurposeFields(dto.purpose, dto);
    await this.assertOwnPhotos(userId, dto.photoIds ?? []);
    const loc = dto.placeId || dto.lat !== undefined
      ? await this.location.resolve(dto)
      : { lat: seller.lat, lng: seller.lng, district: seller.district, area: seller.area };
    const live = seller.verified && !REVIEW_WORDS.test(dto.description ?? '');
    const row = await this.db.one(
      `INSERT INTO vehicles (seller_id, purpose, make_id, model_id, variant, year, body_type, transmission, fuel, drive, steering,
          engine_cc, mileage_km, color, seats, doors, condition, plate, registered, duty_paid, cof_expiry, features, description,
          photo_ids, price_mwk, negotiable, daily_rate_mwk, driver_rate_mwk, self_drive, min_days, district, area, location,
          status, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
               ST_MakePoint($34,$33)::geography, $35, CASE WHEN $35='live' THEN now() END)
       RETURNING id, stock_no, status`,
      [
        userId, dto.purpose, m.make_id, m.id, dto.variant ?? null, dto.year, dto.bodyType ?? m.body_type, dto.transmission, dto.fuel,
        dto.drive ?? '2wd', dto.steering ?? 'right', dto.engineCc ?? null, dto.mileageKm ?? null, dto.color ?? null, dto.seats ?? null,
        dto.doors ?? null, dto.condition ?? 'good', dto.plate?.toUpperCase() ?? null, dto.registered ?? true, dto.dutyPaid ?? true,
        dto.cofExpiry ?? null, dto.features ?? [], dto.description ?? null, dto.photoIds ?? [],
        dto.purpose === 'sale' ? dto.priceMwk : null, dto.negotiable ?? true,
        dto.purpose === 'rent' ? dto.dailyRateMwk : null, dto.purpose === 'rent' ? dto.driverRateMwk ?? null : null,
        dto.purpose === 'rent' ? dto.selfDrive ?? true : true, dto.minDays ?? 1,
        loc.district, loc.area, loc.lat, loc.lng, live ? 'live' : 'pending',
      ],
    );
    return row;
  }

  private async own(userId: string, id: string, client?: Queryable) {
    const v = await this.db.one('SELECT * FROM vehicles WHERE id=$1 AND seller_id=$2', [id, userId], client);
    if (!v) throw new NotFoundException('Car not found');
    return v;
  }

  async update(userId: string, id: string, dto: UpdateVehicleDto) {
    const v = await this.own(userId, id);
    if (v.status === 'sold') throw new BadRequestException('This car is sold and can no longer be edited');
    const seller = await this.db.one('SELECT verified FROM sellers WHERE user_id=$1', [userId]);
    const map: Record<string, string> = {
      variant: 'variant', year: 'year', bodyType: 'body_type', transmission: 'transmission', fuel: 'fuel', drive: 'drive',
      steering: 'steering', engineCc: 'engine_cc', mileageKm: 'mileage_km', color: 'color', seats: 'seats', doors: 'doors',
      condition: 'condition', plate: 'plate', registered: 'registered', dutyPaid: 'duty_paid', cofExpiry: 'cof_expiry',
      features: 'features', description: 'description', photoIds: 'photo_ids', negotiable: 'negotiable',
      dailyRateMwk: 'daily_rate_mwk', driverRateMwk: 'driver_rate_mwk', selfDrive: 'self_drive', minDays: 'min_days',
    };
    const sets: string[] = [];
    const vals: unknown[] = [id];
    const set = (col: string, val: unknown) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    for (const [k, col] of Object.entries(map)) {
      const val = (dto as any)[k];
      if (val !== undefined) set(col, k === 'plate' && typeof val === 'string' ? val.toUpperCase() : val);
    }
    if (dto.photoIds) await this.assertOwnPhotos(userId, dto.photoIds);
    if (dto.modelId !== undefined) {
      const m = await this.model(dto.modelId);
      set('model_id', m.id);
      set('make_id', m.make_id);
      if (dto.bodyType === undefined && m.id !== v.model_id) set('body_type', m.body_type);
    }
    if (dto.priceMwk !== undefined && v.purpose === 'sale') {
      set('price_mwk', dto.priceMwk);
      // A lower price keeps the original as "was" for the Price down badge; a higher price clears it.
      if (dto.priceMwk < Number(v.price_mwk)) set('previous_price_mwk', Math.max(Number(v.previous_price_mwk ?? 0), Number(v.price_mwk)));
      else if (dto.priceMwk > Number(v.price_mwk)) set('previous_price_mwk', null);
    }
    if (dto.placeId !== undefined) {
      const loc = await this.location.resolve({ placeId: dto.placeId });
      vals.push(loc.lng, loc.lat);
      sets.push(`location = ST_MakePoint($${vals.length - 1}, $${vals.length})::geography`);
      set('district', loc.district);
      set('area', loc.area);
    }
    // Unverified sellers' content changes (photos, text, model) go back to review; price edits do not.
    const contentChanged =
      (dto.photoIds !== undefined && dto.photoIds.join(',') !== (v.photo_ids ?? []).join(',')) ||
      (dto.description !== undefined && (dto.description || null) !== (v.description || null)) ||
      (dto.modelId !== undefined && dto.modelId !== v.model_id);
    if (v.status === 'rejected' || (contentChanged && (!seller.verified || REVIEW_WORDS.test(dto.description ?? '')) && v.status === 'live')) {
      set('status', 'pending');
      set('reject_reason', null);
    }
    if (!sets.length) return this.detail(id, { id: userId, phone: '', roles: ['seller'] });
    const pick = <T>(a: T | undefined, b: T) => (a === undefined ? b : a);
    this.checkPurposeFields(v.purpose, {
      priceMwk: pick(dto.priceMwk, v.price_mwk), dailyRateMwk: pick(dto.dailyRateMwk, v.daily_rate_mwk),
      selfDrive: pick(dto.selfDrive, v.self_drive), driverRateMwk: pick(dto.driverRateMwk, v.driver_rate_mwk),
    });
    await this.db.query(`UPDATE vehicles SET ${sets.join(', ')}, updated_at=now() WHERE id=$1`, vals);
    return this.detail(id, { id: userId, phone: '', roles: ['seller'] });
  }

  async setStatus(userId: string, id: string, action: 'pause' | 'resume' | 'sold') {
    const v = await this.own(userId, id);
    const next: Record<string, [string[], string]> = {
      pause: [['live'], 'paused'],
      resume: [['paused'], 'live'],
      sold: [['live', 'paused'], 'sold'],
    };
    const [from, to] = next[action];
    if (!from.includes(v.status)) {
      throw new BadRequestException(v.status === 'reserved' ? 'This car is reserved. Finish or cancel the reservation first.' : `Cannot ${action} a car that is ${v.status}`);
    }
    if (action === 'sold' && v.purpose === 'rent') throw new BadRequestException('Rental cars cannot be marked sold. Pause the listing instead.');
    if (action === 'resume') {
      const open = await this.db.one(`SELECT 1 FROM orders WHERE vehicle_id=$1 AND kind='reservation' AND status IN ('pending_payment','reserved','handed_over','disputed')`, [id]);
      if (open) throw new BadRequestException('This car has an open reservation');
    }
    await this.db.query(`UPDATE vehicles SET status=$2, published_at = COALESCE(published_at, CASE WHEN $2='live' THEN now() END), updated_at=now() WHERE id=$1`, [id, to]);
    return { ok: true, status: to };
  }

  mine(userId: string, status?: string) {
    return this.db.query(
      `SELECT ${CARD}, v.reject_reason, v.created_at,
              (SELECT count(*) FROM inquiries i WHERE i.vehicle_id=v.id) AS inquiries,
              (SELECT count(*) FROM favorites f WHERE f.vehicle_id=v.id) AS favorites
         ${CARD_FROM} WHERE v.seller_id=$1 AND ($2::text IS NULL OR v.status=$2)
        ORDER BY CASE v.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 WHEN 'reserved' THEN 2 WHEN 'live' THEN 3 ELSE 4 END, v.created_at DESC`,
      [userId, status ?? null],
    );
  }

  // ---------------------------------------------------------------- favorites

  async favorite(userId: string, vehicleId: string, on: boolean) {
    if (on) {
      const v = await this.db.one(`SELECT 1 FROM vehicles WHERE id=$1 AND status IN ('live','reserved','sold')`, [vehicleId]);
      if (!v) throw new NotFoundException('Car not found');
      await this.db.query('INSERT INTO favorites (user_id, vehicle_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, vehicleId]);
    } else {
      await this.db.query('DELETE FROM favorites WHERE user_id=$1 AND vehicle_id=$2', [userId, vehicleId]);
    }
    return { ok: true, favorite: on };
  }

  favorites(userId: string) {
    return this.db.query(
      `SELECT ${CARD} ${CARD_FROM} JOIN favorites f ON f.vehicle_id=v.id AND f.user_id=$1
        WHERE v.status IN ('live','reserved','sold') ORDER BY f.created_at DESC`,
      [userId],
    );
  }
}
