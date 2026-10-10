import { ConflictException } from '@nestjs/common';
import { DbService, Queryable } from '../db/db.service';

export type OrderStatus =
  | 'pending_payment' | 'reserved' | 'confirmed' | 'handed_over' | 'returned'
  | 'completed' | 'cancelled' | 'expired' | 'refunded' | 'disputed';

/**
 * Allowed transitions for both order kinds.
 *  Reservation: pending_payment -> reserved -> handed_over -> completed
 *  Rental:      pending_payment -> confirmed -> returned -> completed
 *  Either side can end in cancelled / expired (unpaid), refunded, or disputed -> completed|refunded.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['reserved', 'confirmed', 'cancelled', 'expired'],
  reserved: ['handed_over', 'refunded', 'disputed'],
  confirmed: ['returned', 'refunded', 'disputed'],
  handed_over: ['completed', 'disputed'],
  returned: ['completed', 'disputed'],
  disputed: ['completed', 'refunded'],
  completed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export const OPEN_STATUSES: OrderStatus[] = ['pending_payment', 'reserved', 'confirmed', 'handed_over', 'returned', 'disputed'];

/** Move an order to a new status, guarded by its current status, inside the caller's transaction. */
export async function transition(
  db: DbService,
  client: Queryable,
  orderId: string,
  from: OrderStatus | OrderStatus[],
  to: OrderStatus,
  actorId: string | null,
  note?: string | null,
  extra: Record<string, unknown> = {},
) {
  const froms = Array.isArray(from) ? from : [from];
  for (const f of froms) {
    if (!ALLOWED[f].includes(to)) throw new Error(`Illegal order transition ${f} -> ${to}`);
  }
  const cols = Object.keys(extra);
  const sets = cols.map((c, i) => `${c} = $${i + 4}`);
  const row = await db.one<{ status: OrderStatus; kind: string; vehicle_id: string }>(
    `UPDATE orders o SET status = $2, updated_at = now()${sets.length ? ', ' + sets.join(', ') : ''}
      FROM (SELECT id, status AS prev FROM orders WHERE id = $1 FOR UPDATE) old
     WHERE o.id = old.id AND old.prev = ANY($3::text[])
     RETURNING old.prev AS status, o.kind, o.vehicle_id`,
    [orderId, to, froms, ...cols.map((c) => extra[c])],
    client,
  );
  if (!row) throw new ConflictException('This order has changed. Refresh and try again.');
  await db.query(
    `INSERT INTO order_events (order_id, from_status, to_status, actor_id, note) VALUES ($1,$2,$3,$4,$5)`,
    [orderId, row.status, to, actorId, note ?? null],
    client,
  );
  // Keep the car's public status in step with its reservation.
  if (row.kind === 'reservation') {
    if (['reserved', 'handed_over', 'disputed'].includes(to)) {
      await db.query(`UPDATE vehicles SET status='reserved', updated_at=now() WHERE id=$1 AND status IN ('live','reserved')`, [row.vehicle_id], client);
    } else if (to === 'completed') {
      await db.query(`UPDATE vehicles SET status='sold', updated_at=now() WHERE id=$1`, [row.vehicle_id], client);
    } else if (['refunded', 'cancelled', 'expired'].includes(to)) {
      await db.query(`UPDATE vehicles SET status='live', updated_at=now() WHERE id=$1 AND status='reserved'`, [row.vehicle_id], client);
    }
  }
  return row.status;
}
