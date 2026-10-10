import { Injectable, Logger } from '@nestjs/common';
import { config } from '../config';
import { DbService, Queryable } from '../db/db.service';

/**
 * In-app notifications plus outbound SMS. SMS is recorded in sms_outbox first, then sent by the
 * configured driver: `log` prints it (development), `africastalking` calls the AT bulk SMS API.
 * Two-way SMS is limited in Malawi, so SMS is outbound only.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');
  constructor(private readonly db: DbService) {}

  async notify(
    userId: string,
    kind: string,
    title: string,
    body: string,
    opts: { link?: string; sms?: boolean } = {},
    client?: Queryable,
  ) {
    await this.db.query(
      `INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1,$2,$3,$4,$5)`,
      [userId, kind, title, body, opts.link ?? null],
      client,
    );
    if (opts.sms) {
      const user = await this.db.one<{ phone: string }>('SELECT phone FROM users WHERE id = $1', [userId], client);
      if (user) await this.sms(user.phone, `GalimotoYanga: ${body}`, client);
    }
  }

  /** Queue and send an SMS. Never throws: SMS failure must not break an order or payment. */
  async sms(toPhone: string, body: string, client?: Queryable) {
    const text = body.length > 459 ? body.slice(0, 456) + '...' : body; // max 3 SMS segments
    const row = await this.db.one<{ id: number }>(
      `INSERT INTO sms_outbox (to_phone, body) VALUES ($1,$2) RETURNING id`,
      [toPhone, text],
      client,
    );
    // Send after the surrounding transaction has had a chance to commit.
    setImmediate(() => this.deliver(row!.id, toPhone, text).catch(() => undefined));
  }

  private async deliver(id: number, to: string, body: string) {
    try {
      if (config.smsDriver === 'log') {
        this.log.log(`SMS to ${to}: ${body}`);
        await this.db.query(`UPDATE sms_outbox SET status='logged', sent_at=now() WHERE id=$1`, [id]);
        return;
      }
      const params = new URLSearchParams({ username: config.atUsername, to, message: body });
      if (config.atSenderId) params.set('from', config.atSenderId);
      const res = await fetch(`${config.atBaseUrl}/version1/messaging`, {
        method: 'POST',
        headers: { apiKey: config.atApiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) throw new Error(`Africa's Talking HTTP ${res.status}: ${await res.text()}`);
      await this.db.query(`UPDATE sms_outbox SET status='sent', sent_at=now() WHERE id=$1`, [id]);
    } catch (e) {
      this.log.warn(`SMS ${id} failed: ${(e as Error).message}`);
      await this.db.query(`UPDATE sms_outbox SET status='failed', error=$2 WHERE id=$1`, [id, (e as Error).message]).catch(() => undefined);
    }
  }

  list(userId: string) {
    return this.db.query(
      `SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [userId],
    );
  }

  async markRead(userId: string) {
    await this.db.query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [userId]);
    return { ok: true };
  }
}
