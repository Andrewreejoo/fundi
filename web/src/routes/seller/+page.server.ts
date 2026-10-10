import { redirect } from '@sveltejs/kit';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals, url);
  if (!user.is_seller) redirect(303, '/sell');
  const status = url.searchParams.get('status') || undefined;
  const [seller, cars, orders] = await Promise.all([
    locals.api.get('/sellers/me'),
    locals.api.get(`/sellers/me/vehicles${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    locals.api.get('/orders?as=seller&scope=active'),
  ]);
  return { seller, cars, orders, status: status ?? '' };
};

export const actions: Actions = {
  status: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/vehicles/${f.get('id')}/status`, { action: String(f.get('action')) }));
    if (!r.ok) return r.failure;
    return { ok: true };
  },
  profile: async ({ locals, request }) => {
    const f = await request.formData();
    const placeId = Number(f.get('placeId'));
    const r = await attempt(
      () =>
        locals.api.patch('/sellers/me', {
          name: String(f.get('name') ?? '').trim(),
          address: String(f.get('address') ?? '').trim(),
          about: String(f.get('about') ?? '').trim(),
          payoutPhone: String(f.get('payoutPhone') ?? '').trim() || undefined,
          whatsapp: f.get('whatsapp') === 'on',
          placeId: placeId || undefined,
        }),
      { form: 'profile' },
    );
    if (!r.ok) return r.failure;
    return { ok: true, saved: 'profile' };
  },
};
