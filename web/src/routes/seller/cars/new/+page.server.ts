import { redirect } from '@sveltejs/kit';
import { carFormBody, formError } from '$lib/server/carform';
import { catalog } from '$lib/server/catalog';
import { requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals, url);
  if (!user.is_seller) redirect(303, '/sell');
  const { makes, models, places, settings } = await catalog(locals.api);
  return { makes, models, places, features: settings.features, bodyTypes: settings.bodyTypes, welcome: url.searchParams.has('welcome') };
};

export const actions: Actions = {
  default: async ({ locals, request, url }) => {
    requireUser(locals, url);
    const f = await request.formData();
    const values: Record<string, unknown> = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string'));
    values.features = f.getAll('features').map(String);
    let car: any;
    try {
      const { purpose, body } = await carFormBody(locals.api, f);
      car = await locals.api.post('/vehicles', { purpose, ...body });
    } catch (e) {
      return formError(e, values);
    }
    redirect(303, `/seller/cars/${car.id}?saved=${car.status === 'live' ? 'live' : 'pending'}`);
  },
};
