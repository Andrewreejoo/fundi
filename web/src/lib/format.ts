export const mwk = (n: number | null | undefined) => (n == null ? '' : `MWK ${Number(n).toLocaleString('en-US')}`);

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' });
}

/** "1 h 42 min" until a timestamp, or null if past. */
export function timeLeft(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export function localPhone(e164: string | null | undefined) {
  if (!e164) return '';
  const l = e164.replace(/^\+265/, '0');
  return l.includes('xxx') ? l : `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}`;
}
