import { catalog, placesByDistrict, readLocation } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { categories, places } = await catalog(locals.api);
  return { categories, districts: placesByDistrict(places), saved: readLocation(cookies.get('fundi_loc')) };
};
