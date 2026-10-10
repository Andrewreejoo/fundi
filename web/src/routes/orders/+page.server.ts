import { requireUser } from '$lib/server/forms';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals, url);
  const as = url.searchParams.get('as') === 'seller' && user.is_seller ? 'seller' : 'buyer';
  const scope = url.searchParams.get('scope') === 'past' ? 'past' : 'active';
  return { orders: await locals.api.get(`/orders?as=${as}&scope=${scope}`), as, scope };
};
