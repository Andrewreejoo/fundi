import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  try {
    const [seller, sale, rent] = await Promise.all([
      locals.api.get(`/sellers/${params.id}`),
      locals.api.get(`/vehicles?seller=${params.id}&perPage=60`),
      locals.api.get(`/vehicles?purpose=rent&seller=${params.id}&perPage=60`),
    ]);
    return { seller, sale: sale.results, rent: rent.results };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'Seller not found');
    throw e;
  }
};
