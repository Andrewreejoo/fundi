import { fail, redirect } from '@sveltejs/kit';
import { attempt, requireUser } from '$lib/server/forms';
import type { Api } from '$lib/server/api';
import type { Actions, PageServerLoad } from './$types';

const MAX_BYTES = 3 * 1024 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals, url);
  if (!user.roles.includes('provider')) redirect(303, '/become-a-fundi');
  const [me, active, past] = await Promise.all([
    locals.api.get('/providers/me'),
    locals.api.get('/bookings?as=provider&scope=active'),
    locals.api.get('/bookings?as=provider&scope=past'),
  ]);
  return { me, active, past: past.slice(0, 10), welcome: url.searchParams.get('welcome') === '1' };
};

async function uploadFile(api: Api, file: File, isPrivate: boolean) {
  if (!file || file.size === 0) throw new Error('Choose a photo first');
  if (file.size > MAX_BYTES) throw new Error('Photo is too large (max 3 MB). Take it again at lower quality.');
  const fd = new FormData();
  fd.append('file', file, file.name);
  return api.upload(`/uploads${isPrivate ? '?private=true' : ''}`, fd);
}

export const actions: Actions = {
  availability: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.patch('/providers/me', { availableToday: f.get('available') === 'true' }));
    if (!r.ok) return r.failure;
    return { saved: 'availability' };
  },

  settings: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() =>
      locals.api.patch('/providers/me', {
        payoutPhone: String(f.get('payoutPhone') ?? '').trim() || undefined,
        serviceRadiusKm: Number(f.get('radius')) || undefined,
        workHours: String(f.get('workHours') ?? '').trim() || undefined,
        bio: String(f.get('bio') ?? '').trim() || undefined,
        homeVisits: f.get('homeVisits') === 'on',
      }),
    );
    if (!r.ok) return r.failure;
    return { saved: 'settings' };
  },

  addListing: async ({ locals, request }) => {
    const f = await request.formData();
    const priceType = String(f.get('priceType') ?? 'fixed');
    const photo = f.get('photo') as File | null;
    let photoIds: string[] = [];
    if (photo && photo.size > 0) {
      try { photoIds = [(await uploadFile(locals.api, photo, false)).id]; } catch (e) { return fail(400, { error: (e as Error).message }); }
    }
    const r = await attempt(() =>
      locals.api.post('/providers/me/listings', {
        categoryId: Number(f.get('category')),
        title: String(f.get('title') ?? '').trim(),
        description: String(f.get('description') ?? '').trim() || undefined,
        priceType,
        priceMwk: priceType === 'quote' ? undefined : Number(String(f.get('price') ?? '').replace(/[^\d]/g, '')) || undefined,
        photoIds,
      }),
    );
    if (!r.ok) return r.failure;
    return { saved: 'listing' };
  },

  listingStatus: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.patch(`/providers/me/listings/${f.get('id')}`, { status: f.get('status') }));
    if (!r.ok) return r.failure;
    return { saved: 'listing' };
  },

  addPhoto: async ({ locals, request }) => {
    const f = await request.formData();
    try {
      const up = await uploadFile(locals.api, f.get('photo') as File, false);
      const existing = String(f.get('existing') ?? '').split(',').filter(Boolean);
      const r = await attempt(() => locals.api.patch(`/providers/me/listings/${f.get('id')}`, { photoIds: [...existing, up.id].slice(-6) }));
      if (!r.ok) return r.failure;
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { saved: 'photo' };
  },

  verify: async ({ locals, request }) => {
    const f = await request.formData();
    try {
      const id = await uploadFile(locals.api, f.get('idPhoto') as File, true);
      const selfie = await uploadFile(locals.api, f.get('selfie') as File, true);
      const r = await attempt(() => locals.api.post('/providers/me/verification', { idFileId: id.id, selfieFileId: selfie.id }));
      if (!r.ok) return r.failure;
    } catch (e) {
      return fail(400, { error: (e as Error).message });
    }
    return { saved: 'verification' };
  },
};
