export const mwk = (n: number | string | null | undefined) =>
  n == null || n === '' ? '' : `MWK ${Number(n).toLocaleString('en-US')}`;

/** Compact millions for tight spots: 32,000,000 -> "32M", 12,500,000 -> "12.5M". */
export function mwkShort(n: number | null | undefined) {
  if (n == null) return '';
  if (n >= 1_000_000) return `MWK ${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `MWK ${Math.round(n / 1_000)}k`;
  return `MWK ${n}`;
}

export const km = (n: number | null | undefined) => (n == null ? '' : `${Number(n).toLocaleString('en-US')} km`);
export const cc = (n: number | null | undefined) => (n == null ? '' : `${Number(n).toLocaleString('en-US')} cc`);

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Blantyre' });
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Blantyre' });
}

export function timeLeft(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

export function localPhone(e164: string | null | undefined) {
  if (!e164) return '';
  const l = e164.replace(/^\+265/, '0');
  return l.includes('xxx') ? l : `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}`;
}

/** wa.me link for WhatsApp, with an opening message. */
export const whatsapp = (e164: string, text: string) => `https://wa.me/${e164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

export const carTitle = (v: { year?: number; make?: string; model?: string; variant?: string | null }) =>
  [v.year, v.make, v.model].filter(Boolean).join(' ');

export const cap = (s: string | null | undefined) => (s ? s[0].toUpperCase() + s.slice(1) : '');

export const BODY_LABEL: Record<string, string> = {
  sedan: 'Sedan', hatchback: 'Hatchback', suv: 'SUV', pickup: 'Pickup', minibus: 'Minivan', wagon: 'Wagon',
  van: 'Van', truck: 'Truck', bus: 'Bus', coupe: 'Coupe',
};

export const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Waiting for payment', reserved: 'Reserved', confirmed: 'Booked', handed_over: 'Handed over',
  returned: 'Returned', completed: 'Completed', cancelled: 'Cancelled', expired: 'Expired', refunded: 'Refunded', disputed: 'Problem reported',
};

/** Today's date in Malawi (UTC+2) as YYYY-MM-DD. */
export const todayMw = () => new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
