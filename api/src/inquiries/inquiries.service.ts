import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Buyer <-> seller message threads, one per buyer per car (BE FORWARD-style inquiry). */
@Injectable()
export class InquiriesService {
  constructor(private readonly db: DbService, private readonly notifications: NotificationsService) {}

  async start(buyerId: string, vehicleId: string, body: string) {
    const v = await this.db.one(
      `SELECT v.id, v.seller_id, v.stock_no, mk.name || ' ' || md.name AS car FROM vehicles v
         JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
        WHERE v.id=$1 AND v.status IN ('live','reserved')`,
      [vehicleId],
    );
    if (!v) throw new NotFoundException('Car not found');
    if (v.seller_id === buyerId) throw new BadRequestException('This is your own car');
    return this.db.tx(async (c) => {
      const t = await this.db.one(
        `INSERT INTO inquiries (vehicle_id, buyer_id, seller_id) VALUES ($1,$2,$3)
         ON CONFLICT (vehicle_id, buyer_id) DO UPDATE SET last_message_at=now() RETURNING id`,
        [v.id, buyerId, v.seller_id],
        c,
      );
      await this.db.query(`INSERT INTO inquiry_messages (inquiry_id, sender_id, body) VALUES ($1,$2,$3)`, [t.id, buyerId, body.trim()], c);
      await this.notifications.notify(v.seller_id, 'inquiry', `New inquiry: ${v.car}`,
        `Someone asked about ${v.car} (${v.stock_no}): "${body.trim().slice(0, 120)}"`, { link: `/inquiries/${t.id}`, sms: true }, c);
      return { id: t.id };
    });
  }

  list(userId: string) {
    return this.db.query(
      `SELECT i.id, i.vehicle_id, i.last_message_at, v.stock_no, v.year, v.photo_ids[1] AS photo_id, v.body_type, v.color,
              mk.name AS make, md.name AS model, v.status AS vehicle_status,
              CASE WHEN i.buyer_id=$1 THEN 'buyer' ELSE 'seller' END AS role,
              CASE WHEN i.buyer_id=$1 THEN s.name ELSE COALESCE(bu.name, 'Buyer') END AS other_name,
              (SELECT body FROM inquiry_messages m WHERE m.inquiry_id=i.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT count(*) FROM inquiry_messages m WHERE m.inquiry_id=i.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
         FROM inquiries i JOIN vehicles v ON v.id=i.vehicle_id JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=i.seller_id JOIN users bu ON bu.id=i.buyer_id
        WHERE i.buyer_id=$1 OR i.seller_id=$1 ORDER BY i.last_message_at DESC LIMIT 100`,
      [userId],
    );
  }

  async thread(userId: string, id: string, isAdmin = false) {
    const t = await this.db.one(
      `SELECT i.*, v.stock_no, v.year, v.photo_ids[1] AS photo_id, v.body_type, v.color, v.purpose, v.price_mwk, v.daily_rate_mwk,
              mk.name AS make, md.name AS model, s.name AS seller_name, COALESCE(bu.name,'Buyer') AS buyer_name,
              bu.phone AS buyer_phone, su.phone AS seller_phone
         FROM inquiries i JOIN vehicles v ON v.id=i.vehicle_id JOIN makes mk ON mk.id=v.make_id JOIN models md ON md.id=v.model_id
         JOIN sellers s ON s.user_id=i.seller_id JOIN users bu ON bu.id=i.buyer_id JOIN users su ON su.id=i.seller_id
        WHERE i.id=$1`,
      [id],
    );
    if (!t || (!isAdmin && t.buyer_id !== userId && t.seller_id !== userId)) throw new NotFoundException('Conversation not found');
    await this.db.query(`UPDATE inquiry_messages SET read_at=now() WHERE inquiry_id=$1 AND sender_id <> $2 AND read_at IS NULL`, [id, userId]);
    const messages = await this.db.query(
      `SELECT id, sender_id, body, created_at, (sender_id=$2) AS mine FROM inquiry_messages WHERE inquiry_id=$1 ORDER BY created_at, id`,
      [id, userId],
    );
    return { ...t, role: t.buyer_id === userId ? 'buyer' : 'seller', messages };
  }

  async reply(userId: string, id: string, body: string) {
    const t = await this.db.one('SELECT id, buyer_id, seller_id, vehicle_id FROM inquiries WHERE id=$1', [id]);
    if (!t || (t.buyer_id !== userId && t.seller_id !== userId)) throw new NotFoundException('Conversation not found');
    await this.db.tx(async (c) => {
      await this.db.query(`INSERT INTO inquiry_messages (inquiry_id, sender_id, body) VALUES ($1,$2,$3)`, [id, userId, body.trim()], c);
      await this.db.query(`UPDATE inquiries SET last_message_at=now() WHERE id=$1`, [id], c);
      const to = userId === t.buyer_id ? t.seller_id : t.buyer_id;
      await this.notifications.notify(to, 'inquiry_reply', 'New message', body.trim().slice(0, 160), { link: `/inquiries/${id}`, sms: true }, c);
    });
    return this.thread(userId, id);
  }
}
