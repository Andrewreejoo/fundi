import { error, redirect } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { catalog, readIds } from '$lib/server/catalog';
import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  let car: any;
  try {
    car = await locals.api.get(`/vehicles/${encodeURIComponent(params.stock)}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'This car is not on Galimoto any more');
    throw e;
  }
  const { settings } = await catalog(locals.api);
  // Remember recently viewed cars (newest first) for the home page.
  const recent = [car.id, ...readIds(cookies.get('gm_recent'), 8).filter((x) => x !== car.id)].slice(0, 8);
  cookies.set('gm_recent', recent.join(','), { path: '/', maxAge: 60 * 60 * 24 * 60, httpOnly: false, sameSite: 'lax' });
  const s = settings;
  const deposit = car.price_mwk
    ? Math.min(Number(car.price_mwk), Math.min(s.depositMaxMwk, Math.max(s.depositMinMwk, Math.round((car.price_mwk * s.depositPercent) / 100))))
    : 0;
  return {
    car,
    deposit,
    settings,
    comparing: readIds(cookies.get('gm_compare'), 4).includes(car.id),
  };
};

function needLogin(locals: App.Locals, url: URL) {
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
}

export const actions: Actions = {
  reserve: async ({ locals, request, url }) => {
    needLogin(locals, url);
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/vehicles/${f.get('id')}/reserve`, { note: String(f.get('note') ?? '').trim() || undefined }));
    if (!r.ok) return r.failure;
    redirect(303, `/orders/${r.value.id}`);
  },

  rent: async ({ locals, request, url }) => {
    needLogin(locals, url);
    const f = await request.formData();
    const values = Object.fromEntries(f);
    const r = await attempt(
      () =>
        locals.api.post(`/vehicles/${f.get('id')}/rent`, {
          startDate: String(f.get('start') ?? ''),
          endDate: String(f.get('end') ?? ''),
          withDriver: f.get('withDriver') === 'on',
          note: String(f.get('note') ?? '').trim() || undefined,
        }),
      { values, form: 'rent' },
    );
    if (!r.ok) return r.failure;
    redirect(303, `/orders/${r.value.id}`);
  },

  inquire: async ({ locals, request, url }) => {
    needLogin(locals, url);
    const f = await request.formData();
    const body = String(f.get('body') ?? '').trim();
    if (body.length < 2) return { error: 'Write your question first.', form: 'inquire' };
    const r = await attempt(() => locals.api.post(`/vehicles/${f.get('id')}/inquiries`, { body }), { form: 'inquire' });
    if (!r.ok) return r.failure;
    redirect(303, `/messages/${r.value.id}?sent=1`);
  },
};
