import { redirect } from '@sveltejs/kit';
import { catalog, placesByDistrict } from '$lib/server/catalog';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  if (locals.user?.roles.includes('provider')) redirect(303, '/provider');
  const { categories, places } = await catalog(locals.api);
  return { categories, districts: placesByDistrict(places), signedIn: !!locals.user, nextUrl: url.pathname };
};

export const actions: Actions = {
  default: async ({ request, locals, url }) => {
    requireUser(locals, url);
    const f = await request.formData();
    const values = Object.fromEntries(f);
    const trades = f.getAll('trades').map(String);
    if (!trades.length) return { error: 'Choose at least one trade.', values };
    if (f.get('consent') !== 'on') return { error: 'Please agree to the terms to continue.', values };

    const created = await attempt(
      () =>
        locals.api.post('/providers', {
          displayName: String(f.get('displayName') ?? '').trim(),
          trades,
          placeId: Number(f.get('place')),
          landmark: String(f.get('landmark') ?? '').trim() || undefined,
          payoutPhone: String(f.get('payoutPhone') ?? '').trim() || undefined,
          bio: String(f.get('bio') ?? '').trim() || undefined,
          yearsExperience: f.get('years') ? Number(f.get('years')) : undefined,
          homeVisits: f.get('homeVisits') === 'on',
        }),
      { values },
    );
    if (!created.ok) return created.failure;

    const title = String(f.get('serviceTitle') ?? '').trim();
    if (title) {
      const priceType = String(f.get('priceType') ?? 'quote');
      await attempt(() =>
        locals.api.post('/providers/me/listings', {
          categorySlug: trades[0],
          title,
          priceType,
          priceMwk: priceType === 'quote' ? undefined : Number(String(f.get('price') ?? '').replace(/[^\d]/g, '')) || undefined,
        }),
      );
    }
    redirect(303, '/provider?welcome=1');
  },
};
