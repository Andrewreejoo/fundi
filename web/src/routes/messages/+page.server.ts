import { requireUser } from '$lib/server/forms';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireUser(locals, url);
  return { threads: await locals.api.get('/inquiries') };
};
