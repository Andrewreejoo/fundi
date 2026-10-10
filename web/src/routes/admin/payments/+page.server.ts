import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') ?? '';
  return { items: await locals.api.get(`/admin/payments${status ? `?status=${status}` : ''}`), status };
};

export const actions: Actions = {
  retry: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/payments/${f.get('id')}/retry`));
    return r.ok ? { done: `Retry sent: ${r.value.status}` } : r.failure;
  },
};
