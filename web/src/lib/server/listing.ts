import type { Cookies } from '@sveltejs/kit';
import { catalog, districts, readIds } from './catalog';

const KEYS = ['make', 'model', 'minPrice', 'maxPrice', 'minYear', 'maxYear', 'maxMileage', 'transmission', 'fuel', 'drive',
  'district', 'sellerKind', 'q', 'sort', 'page', 'priceDown', 'withDriver', 'minSeats', 'from', 'to', 'seller'];

/** Shared loader for /cars (for sale) and /rent (for hire). Filters are plain query parameters. */
export async function loadListing(purpose: 'sale' | 'rent', url: URL, locals: App.Locals, cookies: Cookies) {
  const cat = await catalog(locals.api);
  const qs = new URLSearchParams({ purpose, perPage: '20' });
  for (const k of KEYS) {
    const v = url.searchParams.get(k);
    if (v) qs.set(k, v);
  }
  const bodies = url.searchParams.getAll('body').flatMap((b) => b.split(',')).filter(Boolean);
  if (bodies.length) qs.set('body', bodies.join(','));
  if (purpose === 'rent' && (qs.has('from') !== qs.has('to'))) { qs.delete('from'); qs.delete('to'); }

  let result: any;
  let error = '';
  try {
    result = await locals.api.get(`/vehicles?${qs}`);
  } catch (e) {
    error = (e as Error).message;
    result = { total: 0, page: 1, pages: 1, results: [], facets: { makes: [], bodyTypes: [] } };
  }
  if (locals.user) {
    const favs: any[] = await locals.api.get('/me/favorites').catch(() => []);
    const ids = new Set(favs.map((f) => f.id));
    for (const r of result.results) r.is_favorite = ids.has(r.id);
  }
  const s = cat.settings;
  const deposit = (price: number) => Math.min(price, Math.min(s.depositMaxMwk, Math.max(s.depositMinMwk, Math.round((price * s.depositPercent) / 100))));
  for (const r of result.results) if (r.price_mwk) r.deposit = deposit(Number(r.price_mwk));

  const make = url.searchParams.get('make') ?? '';
  return {
    purpose,
    result,
    error,
    filters: Object.fromEntries([...KEYS.map((k) => [k, url.searchParams.get(k) ?? '']), ['body', bodies]]),
    makes: cat.makes.filter((m: any) => (purpose === 'sale' ? m.sale_count : m.rent_count) > 0 || m.slug === make),
    models: cat.models.filter((m: any) => m.make_slug === make),
    allModels: cat.models,
    bodyTypes: cat.settings.bodyTypes,
    districts: districts(cat.places),
    compare: readIds(cookies.get('gm_compare'), 4),
  };
}
