import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') ?? 'pending';
  return { items: await locals.api.get(`/admin/verifications?status=${status}`), status };
};

export const actions: Actions = {
  approve: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/verifications/${f.get('id')}/approve`));
    return r.ok ? { done: 'Approved' } : r.failure;
  },
  reject: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/verifications/${f.get('id')}/reject`, { reason: String(f.get('reason') ?? '') }));
    return r.ok ? { done: 'Rejected' } : r.failure;
  },
};
