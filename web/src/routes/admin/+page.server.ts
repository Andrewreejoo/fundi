import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const days = Number(url.searchParams.get('days')) || 7;
  const [overview, ledger] = await Promise.all([locals.api.get(`/admin/overview?days=${days}`), locals.api.get('/admin/ledger')]);
  return { overview, ledger, days };
};
