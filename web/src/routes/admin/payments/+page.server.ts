import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') ?? '';
  const [list, ledger] = await Promise.all([
    locals.api.get(`/admin/payments${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    locals.api.get('/admin/ledger'),
  ]);
  return { status, list, ledger };
};

export const actions: Actions = {
  retry: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/payments/${f.get('id')}/retry`));
    return r.ok ? { ok: true } : r.failure;
  },
};
