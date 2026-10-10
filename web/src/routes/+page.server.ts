import { catalog, districts, readIds } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const cat = await catalog(locals.api);
  const recent = readIds(cookies.get('gm_recent'), 8);
  const [stats, fresh, dropped, rentals, recentSale, recentRent] = await Promise.all([
    locals.api.get('/stats'),
    locals.api.get('/vehicles?sort=newest&perPage=8'),
    locals.api.get('/vehicles?priceDown=true&perPage=4'),
    locals.api.get('/vehicles?purpose=rent&sort=newest&perPage=4'),
    recent.length ? locals.api.get(`/vehicles?ids=${recent.slice(0, 4).join(',')}&perPage=4`) : null,
    recent.length ? locals.api.get(`/vehicles?purpose=rent&ids=${recent.slice(0, 4).join(',')}&perPage=4`) : null,
  ]);
  const recentCars = [...(recentSale?.results ?? []), ...(recentRent?.results ?? [])].sort(
    (a: any, b: any) => recent.indexOf(a.id) - recent.indexOf(b.id),
  );
  return {
    stats,
    makes: cat.makes.filter((m: any) => m.sale_count > 0 || m.rent_count > 0),
    allMakes: cat.makes,
    models: cat.models,
    bodyTypes: cat.settings.bodyTypes,
    districts: districts(cat.places),
    fresh: fresh.results,
    dropped: dropped.results,
    rentals: rentals.results,
    recent: recentCars,
  };
};
