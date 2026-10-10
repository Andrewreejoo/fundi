import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = ['approved', 'rejected'].includes(url.searchParams.get('status') ?? '') ? url.searchParams.get('status')! : 'pending';
  return { status, list: await locals.api.get(`/admin/access-requests?status=${status}`) };
};

export const actions: Actions = {
  approve: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/access-requests/${f.get('id')}/approve`));
    return r.ok ? { ok: true } : r.failure;
  },
  reject: async ({ locals, request }) => {
    const f = await request.formData();
    const reason = String(f.get('reason') ?? '').trim();
    const r = await attempt(() => locals.api.post(`/admin/access-requests/${f.get('id')}/reject`, { reason: reason || 'We could not verify your details' }));
    return r.ok ? { ok: true } : r.failure;
  },
};
