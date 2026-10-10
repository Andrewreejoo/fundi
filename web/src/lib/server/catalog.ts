import type { Api } from './api';

/** Makes, models, places and settings change rarely: cache them in memory for 5 minutes. */
let cache: { at: number; makes: any[]; models: any[]; places: any[]; settings: any } | null = null;

export async function catalog(api: Api) {
  if (!cache || Date.now() - cache.at > 300_000) {
    const [makes, models, places, settings] = await Promise.all([api.get('/makes'), api.get('/models'), api.get('/places'), api.get('/config')]);
    cache = { at: Date.now(), makes, models, places, settings };
  }
  return cache;
}

export function placesByDistrict(places: any[]) {
  const out: Record<string, any[]> = {};
  for (const p of places) (out[p.district] ??= []).push(p);
  return out;
}

export const districts = (places: any[]) => [...new Set(places.map((p) => p.district as string))];

/** Cookie-held list of ids (compare list, recently viewed). */
export function readIds(v: string | undefined, max: number) {
  return (v ?? '').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, max);
}
