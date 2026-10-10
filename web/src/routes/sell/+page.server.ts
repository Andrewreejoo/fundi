import { redirect } from '@sveltejs/kit';
import { catalog } from '$lib/server/catalog';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user?.is_seller) redirect(303, '/seller');
  const { places, settings } = await catalog(locals.api);
  return { places, settings };
};

export const actions: Actions = {
  default: async ({ locals, request, url }) => {
    requireUser(locals, url);
    const f = await request.formData();
    const values = Object.fromEntries(f);
    const placeId = Number(f.get('placeId'));
    const r = await attempt(
      () =>
        locals.api.post('/sellers', {
          kind: f.get('kind') === 'dealer' ? 'dealer' : 'private',
          name: String(f.get('name') ?? '').trim(),
          placeId: placeId || undefined,
          address: String(f.get('address') ?? '').trim() || undefined,
          payoutPhone: String(f.get('payoutPhone') ?? '').trim() || undefined,
          about: String(f.get('about') ?? '').trim() || undefined,
          whatsapp: f.get('whatsapp') === 'on',
        }),
      { values },
    );
    if (!r.ok) return r.failure;
    redirect(303, '/seller/cars/new?welcome=1');
  },
};
