import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') || 'pending';
  return { status, list: await locals.api.get(`/admin/listings?status=${encodeURIComponent(status)}`) };
};

export const actions: Actions = {
  approve: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/listings/${f.get('id')}/approve`));
    return r.ok ? { ok: true } : r.failure;
  },
  reject: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/listings/${f.get('id')}/reject`, { reason: String(f.get('reason') ?? '').trim() }));
    return r.ok ? { ok: true } : r.failure;
  },
  feature: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/listings/${f.get('id')}/feature`, { on: f.get('on') === 'true' }));
    return r.ok ? { ok: true } : r.failure;
  },
};
