import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationService } from '../catalog/location.service';
import { normalizeMwPhone, operatorFor } from '../common/phone';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SellerDto, UpdateSellerDto } from './sellers.dto';

const PUBLIC = `s.user_id AS id, s.kind, s.name, s.about, s.district, s.area, s.address, s.verified, s.created_at,
  (SELECT count(*) FROM vehicles v WHERE v.seller_id=s.user_id AND v.status IN ('live','reserved')) AS live_count,
  (SELECT count(*) FROM vehicles v WHERE v.seller_id=s.user_id AND v.status='sold') AS sold_count`;

@Injectable()
export class SellersService {
  constructor(private readonly db: DbService, private readonly location: LocationService, private readonly notifications: NotificationsService) {}

  private payout(input: string) {
    const phone = normalizeMwPhone(input);
    if (!phone) throw new BadRequestException('Payout number must be an Airtel or TNM number');
    return { msisdn: phone, operator: operatorFor(phone)! };
  }

  async become(user: { id: string; phone: string }, dto: SellerDto) {
    return this.db.tx(async (c) => {
      if (await this.db.one('SELECT 1 FROM sellers WHERE user_id=$1', [user.id], c)) throw new BadRequestException('You already have a seller account');
      const loc = await this.location.resolve(dto, c);
      const p = this.payout(dto.payoutPhone ?? user.phone);
      await this.db.query(
        `INSERT INTO sellers (user_id, kind, name, about, district, area, address, location, payout_msisdn, payout_operator, whatsapp)
         VALUES ($1,$2,$3,$4,$5,$6,$7, ST_MakePoint($9,$8)::geography, $10,$11,$12)`,
        [user.id, dto.kind, dto.name, dto.about ?? null, loc.district, loc.area, dto.address ?? null, loc.lat, loc.lng, p.msisdn, p.operator, dto.whatsapp ?? true],
        c,
      );
      await this.db.query(
        `UPDATE users SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || '{seller}'::text[]) r), name = COALESCE(name, $2), updated_at=now() WHERE id=$1`,
        [user.id, dto.name],
        c,
      );
      await this.db.audit(user.id, 'seller.create', 'seller', user.id, { kind: dto.kind }, c);
      await this.notifications.notify(user.id, 'welcome', 'Seller account ready',
        'You can now list cars for sale or rent. New listings are checked by our team before they go live.', { link: '/seller' }, c);
      return this.mine(user.id, c);
    });
  }

  async update(userId: string, dto: UpdateSellerDto) {
    const s = await this.db.one('SELECT user_id FROM sellers WHERE user_id=$1', [userId]);
    if (!s) throw new NotFoundException('Create a seller account first');
    const sets: string[] = [];
    const vals: unknown[] = [userId];
    const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (dto.name !== undefined) set('name', dto.name);
    if (dto.about !== undefined) set('about', dto.about);
    if (dto.address !== undefined) set('address', dto.address);
    if (dto.whatsapp !== undefined) set('whatsapp', dto.whatsapp);
    if (dto.payoutPhone !== undefined) {
      const p = this.payout(dto.payoutPhone);
      set('payout_msisdn', p.msisdn);
      set('payout_operator', p.operator);
    }
    if (dto.placeId !== undefined || dto.lat !== undefined) {
      const loc = await this.location.resolve(dto);
      vals.push(loc.lng, loc.lat);
      sets.push(`location = ST_MakePoint($${vals.length - 1}, $${vals.length})::geography`);
      set('district', loc.district);
      set('area', loc.area);
    }
    if (sets.length) await this.db.query(`UPDATE sellers SET ${sets.join(', ')}, updated_at=now() WHERE user_id=$1`, vals);
    return this.mine(userId);
  }

  async mine(userId: string, client?: any) {
    const s = await this.db.one(
      `SELECT ${PUBLIC}, s.payout_msisdn, s.payout_operator, s.whatsapp, s.status,
              ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lng
         FROM sellers s WHERE s.user_id=$1`,
      [userId],
      client,
    );
    if (!s) throw new NotFoundException('Create a seller account first');
    const stats = await this.db.one(
      `SELECT
         (SELECT count(*) FROM vehicles WHERE seller_id=$1 AND status='pending') AS pending_listings,
         (SELECT COALESCE(sum(views),0) FROM vehicles WHERE seller_id=$1) AS total_views,
         (SELECT count(*) FROM orders WHERE seller_id=$1 AND status IN ('reserved','confirmed','handed_over','returned','disputed')) AS open_orders,
         (SELECT count(*) FROM inquiries WHERE seller_id=$1) AS inquiries,
         COALESCE((SELECT sum(p.amount_mwk) FROM payments p JOIN orders o ON o.id=p.order_id
                   WHERE o.seller_id=$1 AND p.direction='payout' AND p.status='success'), 0) AS paid_out_mwk,
         COALESCE((SELECT sum(o.amount_mwk - o.fee_mwk) FROM orders o
                   WHERE o.seller_id=$1 AND o.status IN ('reserved','confirmed','handed_over','returned','disputed')), 0) AS held_mwk`,
      [userId],
      client,
    );
    return { ...s, stats };
  }

  async publicProfile(id: string) {
    const s = await this.db.one(`SELECT ${PUBLIC} FROM sellers s JOIN users u ON u.id=s.user_id WHERE s.user_id=$1 AND s.status='active' AND u.status='active'`, [id]);
    if (!s) throw new NotFoundException('Seller not found');
    return s;
  }
}
