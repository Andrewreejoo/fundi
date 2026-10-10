import { error, redirect } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { catalog, placesByDistrict, readLocation } from '$lib/server/catalog';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url, cookies }) => {
  requireUser(locals, url);
  let provider;
  try {
    provider = await locals.api.get(`/providers/${params.providerId}`);
  } catch (e) {
    if (e instanceof ApiError) error(404, 'This fundi was not found');
    throw e;
  }
  const { places, settings } = await catalog(locals.api);
  return {
    provider,
    listingId: url.searchParams.get('listing') ?? '',
    districts: placesByDistrict(places),
    saved: readLocation(cookies.get('fundi_loc')),
    settings,
    today: new Date().toISOString().slice(0, 10),
  };
};

export const actions: Actions = {
  default: async ({ request, locals, params }) => {
    const f = await request.formData();
    const listingId = String(f.get('listing') ?? '');
    const lat = f.get('lat') ? Number(f.get('lat')) : undefined;
    const lng = f.get('lng') ? Number(f.get('lng')) : undefined;
    const body: Record<string, unknown> = {
      providerId: params.providerId,
      description: String(f.get('description') ?? '').trim() || undefined,
      scheduledFor: String(f.get('date') ?? '') || undefined,
      timeSlot: String(f.get('slot') ?? '') || undefined,
      landmark: String(f.get('landmark') ?? '').trim() || undefined,
      escrow: f.get('escrow') === 'on',
      channel: 'web',
    };
    if (listingId && listingId !== 'quote') body.listingId = listingId;
    else body.categoryId = Number(f.get('category'));
    if (lat !== undefined && lng !== undefined) Object.assign(body, { lat, lng });
    else body.placeId = Number(f.get('place'));

    if (!body.listingId && !body.description) return { error: 'Describe the job so the fundi can give you a price.', values: Object.fromEntries(f) };
    const r = await attempt(() => locals.api.post('/bookings', body), { values: Object.fromEntries(f) });
    if (!r.ok) return r.failure;
    redirect(303, `/bookings/${r.value.id}?new=1`);
  },
};
