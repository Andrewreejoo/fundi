import { redirect } from '@sveltejs/kit';
import { requireUser, safeNext } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireUser(locals, url);
  return { cars: await locals.api.get('/me/favorites') };
};

export const actions: Actions = {
  /** Save or unsave a car. Used by the heart buttons across the site. */
  toggle: async ({ locals, request }) => {
    const f = await request.formData();
    const next = safeNext(f.get('next'), '/favorites');
    if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(next)}`);
    const id = String(f.get('id'));
    const favs: any[] = await locals.api.get('/me/favorites');
    if (favs.some((v) => v.id === id)) await locals.api.del(`/me/favorites/${id}`);
    else await locals.api.put(`/me/favorites/${id}`);
    redirect(303, next);
  },
};
