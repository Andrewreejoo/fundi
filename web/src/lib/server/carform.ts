import { fail } from '@sveltejs/kit';
import type { Api } from './api';
import { ApiError } from './api';

const MAX_PHOTOS = 20;
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  return s ? Number(s) : undefined;
};
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim() || undefined;

/** Upload any new photos, then build the API body for POST/PATCH /vehicles from the car form. */
export async function carFormBody(api: Api, f: FormData, existing: string[] = []) {
  const keep = f.getAll('keep').map(String).filter((id) => existing.includes(id));
  const files = f.getAll('photos').filter((x): x is File => x instanceof File && x.size > 0);
  const uploaded: string[] = [];
  for (const file of files.slice(0, Math.max(0, MAX_PHOTOS - keep.length))) {
    const fd = new FormData();
    fd.append('file', file, file.name || 'photo.jpg');
    uploaded.push((await api.upload('/uploads', fd)).id);
  }
  const cover = str(f.get('cover'));
  let photoIds = [...keep, ...uploaded];
  if (cover && photoIds.includes(cover)) photoIds = [cover, ...photoIds.filter((x) => x !== cover)];

  const purpose = f.get('purpose') === 'rent' ? 'rent' : 'sale';
  const body: Record<string, unknown> = {
    modelId: num(f.get('modelId')),
    variant: str(f.get('variant')),
    year: num(f.get('year')),
    transmission: str(f.get('transmission')),
    fuel: str(f.get('fuel')),
    drive: str(f.get('drive')),
    engineCc: num(f.get('engineCc')),
    mileageKm: num(f.get('mileageKm')),
    color: str(f.get('color')),
    seats: num(f.get('seats')),
    doors: num(f.get('doors')),
    condition: str(f.get('condition')),
    plate: str(f.get('plate')),
    registered: f.get('registered') === 'on',
    dutyPaid: f.get('dutyPaid') === 'on',
    cofExpiry: str(f.get('cofExpiry')),
    features: f.getAll('features').map(String),
    description: str(f.get('description')) ?? '',
    photoIds,
    placeId: num(f.get('placeId')),
  };
  if (purpose === 'sale') {
    body.priceMwk = num(f.get('priceMwk'));
    body.negotiable = f.get('negotiable') === 'on';
  } else {
    body.dailyRateMwk = num(f.get('dailyRateMwk'));
    const driver = String(f.get('driverRateMwk') ?? '').trim();
    body.driverRateMwk = f.get('offerDriver') === 'on' ? num(driver) ?? 0 : null;
    body.selfDrive = f.get('selfDrive') === 'on';
    body.minDays = num(f.get('minDays')) ?? 1;
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return { purpose, body };
}

export function formError(e: unknown, values: Record<string, unknown>) {
  if (e instanceof ApiError) return fail(400, { error: e.message, values });
  throw e;
}
