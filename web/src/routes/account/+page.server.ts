import { redirect } from '@sveltejs/kit';
import { clearTokens } from '$lib/server/api';
import { attempt, requireUser, safeNext } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  requireUser(locals, url);
  const notifications = await locals.api.get('/me/notifications').catch(() => []);
  return { setpin: url.searchParams.get('setpin') === '1', next: safeNext(url.searchParams.get('next'), ''), notifications };
};

export const actions: Actions = {
  profile: async ({ request, locals }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.patch('/me', { name: String(f.get('name') ?? '').trim() || undefined }));
    if (!r.ok) return r.failure;
    return { saved: 'profile' };
  },
  pin: async ({ request, locals }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post('/auth/pin', { pin: String(f.get('pin') ?? '') }));
    if (!r.ok) return r.failure;
    const next = safeNext(f.get('next'), '');
    if (next) redirect(303, next);
    return { saved: 'pin' };
  },
  logout: async ({ locals, cookies }) => {
    const rt = cookies.get('fundi_rt');
    if (rt) await locals.api.post('/auth/logout', { refreshToken: rt }).catch(() => undefined);
    clearTokens(cookies);
    redirect(303, '/');
  },
};
