import { createHash, randomBytes, randomInt } from 'crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const otpCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Short human-friendly booking reference, e.g. FD-7K3P2Q (no 0/O/1/I to avoid misreading over the phone). */
export function bookingRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[randomInt(0, alphabet.length)];
  return `FD-${s}`;
}

export const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600_000);
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

export const formatMwk = (n: number) => `MWK ${n.toLocaleString('en-US')}`;

export function percentOf(amount: number, percent: number) {
  return Math.round((amount * percent) / 100);
}
