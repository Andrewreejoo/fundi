import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const days = Number(url.searchParams.get('days')) || 7;
  return { o: await locals.api.get(`/admin/overview?days=${days}`) };
};
