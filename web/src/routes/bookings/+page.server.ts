import { requireUser } from '$lib/server/forms';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireUser(locals, url);
  const scope = url.searchParams.get('scope') === 'past' ? 'past' : 'active';
  const bookings = await locals.api.get(`/bookings?as=customer&scope=${scope}`);
  return { bookings, scope };
};
