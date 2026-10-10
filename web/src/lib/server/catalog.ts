import type { Api } from './api';

/** Categories and places change rarely: cache them in memory for 10 minutes. */
let cache: { at: number; categories: any[]; places: any[]; settings: any } | null = null;

export async function catalog(api: Api) {
  if (!cache || Date.now() - cache.at > 600_000) {
    const [categories, places, settings] = await Promise.all([api.get('/categories'), api.get('/places'), api.get('/config')]);
    cache = { at: Date.now(), categories, places, settings };
  }
  return { categories: cache.categories, places: cache.places, settings: cache.settings };
}

/** Group places by district for <optgroup>. */
export function placesByDistrict(places: any[]) {
  const out: Record<string, any[]> = {};
  for (const p of places) (out[p.district] ??= []).push(p);
  return out;
}

/** The visitor's last chosen location, remembered in a cookie. */
export function readLocation(value: string | undefined): { placeId?: number; lat?: number; lng?: number; label?: string } {
  if (!value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}
