import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { catalog } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const qs = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
  try {
    const [provider, { categories }] = await Promise.all([locals.api.get(`/providers/${params.id}${qs}`), catalog(locals.api)]);
    return { provider, categories };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'This fundi was not found');
    throw e;
  }
};
