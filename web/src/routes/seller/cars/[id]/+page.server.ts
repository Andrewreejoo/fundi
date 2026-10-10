import { error, redirect } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { carFormBody, formError } from '$lib/server/carform';
import { catalog } from '$lib/server/catalog';
import { requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

async function own(locals: App.Locals, id: string) {
  try {
    const car = await locals.api.get(`/vehicles/${encodeURIComponent(id)}`);
    if (!car.is_owner) error(404, 'Listing not found');
    return car;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'Listing not found');
    throw e;
  }
}

const isoDate = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : '');

export const load: PageServerLoad = async ({ locals, url, params }) => {
  const user = requireUser(locals, url);
  if (!user.is_seller) redirect(303, '/sell');
  const [car, { makes, models, places, settings }] = await Promise.all([own(locals, params.id), catalog(locals.api)]);
  car.cof_expiry = isoDate(car.cof_expiry);
  return { car, makes, models, places, features: settings.features, bodyTypes: settings.bodyTypes, saved: url.searchParams.get('saved') };
};

export const actions: Actions = {
  default: async ({ locals, request, params, url }) => {
    requireUser(locals, url);
    const car = await own(locals, params.id);
    const f = await request.formData();
    const values: Record<string, unknown> = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string'));
    values.features = f.getAll('features').map(String);
    let updated: any;
    try {
      const { body } = await carFormBody(locals.api, f, car.photo_ids ?? []);
      updated = await locals.api.patch(`/vehicles/${car.id}`, body);
    } catch (e) {
      return formError(e, values);
    }
    redirect(303, `/seller/cars/${car.id}?saved=${updated.status === 'pending' ? 'pending' : 'ok'}`);
  },
};
