import { redirect } from '@sveltejs/kit';
import { catalog, readIds } from '$lib/server/catalog';
import { safeNext } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

const MAX = 4;

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const ids = readIds(cookies.get('gm_compare'), MAX);
  const { settings } = await catalog(locals.api);
  if (!ids.length) return { cars: [], features: settings.features };
  // The compare list can mix cars for sale and for hire; fetch full details for each.
  const cars = (await Promise.all(ids.map((id) => locals.api.get(`/vehicles/${id}`).catch(() => null)))).filter(Boolean);
  return { cars, features: settings.features };
};

export const actions: Actions = {
  toggle: async ({ request, cookies }) => {
    const f = await request.formData();
    const id = String(f.get('id'));
    let ids = readIds(cookies.get('gm_compare'), MAX);
    ids = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX);
    cookies.set('gm_compare', ids.join(','), { path: '/', maxAge: 60 * 60 * 24 * 30, httpOnly: false, sameSite: 'lax' });
    redirect(303, safeNext(f.get('next'), '/compare'));
  },
  clear: async ({ cookies }) => {
    cookies.delete('gm_compare', { path: '/' });
    redirect(303, '/compare');
  },
};
