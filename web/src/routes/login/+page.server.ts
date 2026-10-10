import { redirect } from '@sveltejs/kit';
import { storeTokens } from '$lib/server/api';
import { attempt, safeNext } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
  return { next: safeNext(url.searchParams.get('next')), mode: url.searchParams.get('mode') === 'pin' ? 'pin' : 'code' };
};

export const actions: Actions = {
  request: async ({ request, locals }) => {
    const f = await request.formData();
    const phone = String(f.get('phone') ?? '');
    const r = await attempt(() => locals.api.post('/auth/otp/request', { phone }), { phone, step: 'phone' });
    if (!r.ok) return r.failure;
    return { step: 'code', phone, devCode: r.value.devCode as string | undefined };
  },

  verify: async ({ request, locals, cookies }) => {
    const f = await request.formData();
    const phone = String(f.get('phone') ?? '');
    const code = String(f.get('code') ?? '').replace(/\D/g, '');
    const next = safeNext(f.get('next'));
    const r = await attempt(() => locals.api.post('/auth/otp/verify', { phone, code }), { phone, step: 'code' });
    if (!r.ok) return r.failure;
    storeTokens(cookies, r.value, locals.secure);
    redirect(303, r.value.hasPin ? next : `/account?setpin=1&next=${encodeURIComponent(next)}`);
  },

  pin: async ({ request, locals, cookies }) => {
    const f = await request.formData();
    const phone = String(f.get('phone') ?? '');
    const pin = String(f.get('pin') ?? '');
    const r = await attempt(() => locals.api.post('/auth/pin/login', { phone, pin }), { phone, step: 'pin' });
    if (!r.ok) return r.failure;
    storeTokens(cookies, r.value, locals.secure);
    redirect(303, safeNext(f.get('next')));
  },
};
