import { ConflictException } from '@nestjs/common';
import { DbService, Queryable } from '../db/db.service';

export type BookingStatus =
  | 'requested' | 'quoted' | 'accepted' | 'paid' | 'in_progress' | 'completed'
  | 'confirmed' | 'disputed' | 'cancelled' | 'expired' | 'refunded';

/** Allowed transitions (spec 4.4). Anything else is rejected, so the state machine lives in one place. */
const ALLOWED: Record<BookingStatus, BookingStatus[]> = {
  requested: ['quoted', 'accepted', 'cancelled', 'expired'],
  quoted: ['accepted', 'cancelled', 'expired'],
  accepted: ['paid', 'in_progress', 'completed', 'cancelled', 'expired'],
  paid: ['in_progress', 'completed', 'disputed', 'refunded'],
  in_progress: ['completed', 'disputed', 'refunded'],
  completed: ['confirmed', 'disputed'],
  disputed: ['confirmed', 'refunded'],
  confirmed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export const ACTIVE_STATUSES: BookingStatus[] = ['requested', 'quoted', 'accepted', 'paid', 'in_progress', 'completed', 'disputed'];

/**
 * Move a booking to a new status inside the caller's transaction, guarded by the current status
 * (optimistic: the UPDATE matches only if nobody moved it meanwhile). Extra column updates ride along.
 */
export async function transition(
  db: DbService,
  client: Queryable,
  bookingId: string,
  from: BookingStatus | BookingStatus[],
  to: BookingStatus,
  actorId: string | null,
  note?: string | null,
  extra: Record<string, unknown> = {},
) {
  const froms = Array.isArray(from) ? from : [from];
  for (const f of froms) {
    if (!ALLOWED[f].includes(to)) throw new Error(`Illegal booking transition ${f} -> ${to}`);
  }
  const cols = Object.keys(extra);
  const sets = cols.map((c, i) => `${c} = $${i + 4}`);
  const row = await db.one<{ status: BookingStatus }>(
    `UPDATE bookings b SET status = $2, updated_at = now()${sets.length ? ', ' + sets.join(', ') : ''}
      FROM (SELECT id, status AS prev FROM bookings WHERE id = $1 FOR UPDATE) old
     WHERE b.id = old.id AND old.prev = ANY($3::text[])
     RETURNING old.prev AS status`,
    [bookingId, to, froms, ...cols.map((c) => extra[c])],
    client,
  );
  if (!row) throw new ConflictException('This booking has changed. Refresh and try again.');
  await db.query(
    `INSERT INTO booking_events (booking_id, from_status, to_status, actor_id, note) VALUES ($1,$2,$3,$4,$5)`,
    [bookingId, row.status, to, actorId, note ?? null],
    client,
  );
  return row.status;
}
