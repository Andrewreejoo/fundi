import { error } from '@sveltejs/kit';
import { ApiError } from '$lib/server/api';
import { catalog } from '$lib/server/catalog';
import { attempt, requireUser } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
  requireUser(locals, url);
  try {
    const [booking, { settings }] = await Promise.all([locals.api.get(`/bookings/${params.id}`), catalog(locals.api)]);
    return { booking, settings, isNew: url.searchParams.get('new') === '1' };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) error(404, 'Booking not found');
    throw e;
  }
};

/** Each action maps 1:1 to an API endpoint; the API enforces who may do what and when. */
const simple = (path: string) =>
  (async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/bookings/${params.id}/${path}`, { reason: f.get('reason') || undefined }));
    if (!r.ok) return r.failure;
    return { done: path };
  }) satisfies Actions[string];

export const actions: Actions = {
  accept: simple('accept'),
  decline: simple('decline'),
  start: simple('start'),
  complete: simple('complete'),
  acceptQuote: simple('accept-quote'),
  cancel: simple('cancel'),
  confirm: simple('confirm'),

  quote: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() =>
      locals.api.post(`/bookings/${params.id}/quote`, { priceMwk: Number(String(f.get('price') ?? '').replace(/[^\d]/g, '')), note: f.get('note') || undefined }),
    );
    if (!r.ok) return r.failure;
    return { done: 'quote' };
  },

  pay: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/bookings/${params.id}/pay`, { phone: f.get('phone') || undefined }));
    if (!r.ok) return r.failure;
    return { done: 'pay', payment: r.value };
  },

  dispute: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/bookings/${params.id}/dispute`, { reason: String(f.get('reason') ?? '') }));
    if (!r.ok) return r.failure;
    return { done: 'dispute' };
  },

  review: async ({ locals, params, request }) => {
    const f = await request.formData();
    const r = await attempt(() =>
      locals.api.post(`/bookings/${params.id}/review`, { rating: Number(f.get('rating')), text: String(f.get('text') ?? '').trim() || undefined }),
    );
    if (!r.ok) return r.failure;
    return { done: 'review' };
  },
};
