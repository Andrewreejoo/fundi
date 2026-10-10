import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  requireUser(locals, url);
  try {
    return { order: await locals.api.get(`/orders/${params.id}`) };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'Order not found');
    throw e;
  }
};

const act = (path: string) =>
  (async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/orders/${params.id}/${path}`, { reason: String(f.get('reason') ?? '').trim() || undefined }));
    return r.ok ? { done: path } : r.failure;
  }) satisfies Actions[string];

export const actions: Actions = {
  cancel: act('cancel'),
  handover: act('handover'),
  complete: act('complete'),
  pay: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/orders/${params.id}/pay`, { phone: String(f.get('phone') ?? '') || undefined }));
    return r.ok ? { done: 'pay', payment: r.value } : r.failure;
  },
  dispute: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/orders/${params.id}/dispute`, { reason: String(f.get('reason') ?? '') }));
    return r.ok ? { done: 'dispute' } : r.failure;
  },
};
