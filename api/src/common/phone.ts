/**
 * Malawi mobile numbers. Accepts 0991234567, 991234567, 265991234567, +265 99 123 4567.
 * Airtel: 099x / 098x. TNM: 088x / 089x (current prefixes; update if MACRA allocates new ranges).
 */
export type Operator = 'airtel' | 'tnm';

export function normalizeMwPhone(input: string): string | null {
  const digits = (input || '').replace(/\D/g, '');
  let local: string;
  if (digits.startsWith('265') && digits.length === 12) local = digits.slice(3);
  else if (digits.startsWith('0') && digits.length === 10) local = digits.slice(1);
  else if (digits.length === 9) local = digits;
  else return null;
  if (!/^(99|98|88|89)\d{7}$/.test(local)) return null;
  return `+265${local}`;
}

export function operatorFor(e164: string): Operator | null {
  const local = e164.replace(/^\+265/, '');
  if (/^(99|98)/.test(local)) return 'airtel';
  if (/^(88|89)/.test(local)) return 'tnm';
  return null;
}

/** Local 10-digit form (0991234567), which is what wallets and PayChangu expect. */
export function toLocal(e164: string): string {
  return '0' + e164.replace(/^\+265/, '');
}

export function maskPhone(e164: string): string {
  const l = toLocal(e164);
  return `${l.slice(0, 4)} xxx ${l.slice(-3)}`;
}
