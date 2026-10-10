import { catalog, placesByDistrict, readLocation } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  const { categories, places } = await catalog(locals.api);
  const saved = readLocation(cookies.get('fundi_loc'));
  const category = url.searchParams.get('category') ?? '';
  let placeId = url.searchParams.get('place') ?? '';
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  if (!placeId && !lat && saved.placeId) placeId = String(saved.placeId);

  const filters = {
    verifiedOnly: url.searchParams.get('verified') === '1',
    availableToday: url.searchParams.get('today') === '1',
    homeVisit: url.searchParams.get('home') === '1',
    q: url.searchParams.get('q') ?? '',
  };

  let result: { radiusKm: number; results: any[]; center?: { lat: number; lng: number } } | null = null;
  let error = '';
  let locQuery = '';
  if (placeId || (lat && lng)) {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (lat && lng) { qs.set('lat', lat); qs.set('lng', lng); locQuery = `?lat=${lat}&lng=${lng}`; }
    else qs.set('placeId', placeId);
    if (filters.verifiedOnly) qs.set('verifiedOnly', 'true');
    if (filters.availableToday) qs.set('availableToday', 'true');
    if (filters.homeVisit) qs.set('homeVisit', 'true');
    if (filters.q) qs.set('q', filters.q);
    try {
      result = await locals.api.get(`/providers/search?${qs}`);
      if (!locQuery && result?.center) locQuery = `?lat=${result.center.lat}&lng=${result.center.lng}`;
      const place = places.find((p: any) => String(p.id) === placeId);
      cookies.set(
        'fundi_loc',
        JSON.stringify(lat && lng ? { lat: +lat, lng: +lng, label: 'My location' } : { placeId: +placeId, label: place ? `${place.name}, ${place.district}` : '' }),
        { path: '/', maxAge: 60 * 60 * 24 * 180, httpOnly: false, sameSite: 'lax' },
      );
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const place = places.find((p: any) => String(p.id) === placeId);
  return {
    categories, districts: placesByDistrict(places), category, placeId, filters, result, error, locQuery,
    placeLabel: lat ? 'your location' : place ? `${place.name}, ${place.district}` : '',
    categoryInfo: categories.find((c: any) => c.slug === category) ?? null,
  };
};
