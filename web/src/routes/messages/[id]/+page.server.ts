import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  requireUser(locals, url);
  try {
    return { t: await locals.api.get(`/inquiries/${params.id}`), sent: url.searchParams.get('sent') === '1' };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'Conversation not found');
    throw e;
  }
};

export const actions: Actions = {
  default: async ({ locals, params, request }) => {
    const f = await request.formData();
    const body = String(f.get('body') ?? '').trim();
    if (body.length < 2) return { error: 'Write a message first.' };
    const r = await attempt(() => locals.api.post(`/inquiries/${params.id}/messages`, { body }));
    return r.ok ? { sentReply: true } : r.failure;
  },
};
