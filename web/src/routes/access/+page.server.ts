import { fail, redirect } from '@sveltejs/kit';
import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.user) redirect(303, '/');
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const f = await request.formData();
    const values = { name: String(f.get('name') ?? ''), phone: String(f.get('phone') ?? ''), note: String(f.get('note') ?? '') };
    const pin = String(f.get('pin') ?? '');
    if (pin !== String(f.get('pin2') ?? '')) return fail(400, { error: 'The two PINs do not match', values });
    const idPhoto = f.get('idPhoto');
    const selfie = f.get('selfie');
    if (!(idPhoto instanceof File) || idPhoto.size === 0) return fail(400, { error: 'Add a photo of your national ID', values });
    if (!(selfie instanceof File) || selfie.size === 0) return fail(400, { error: 'Add a selfie of your face', values });

    const body = new FormData();
    body.append('name', values.name);
    body.append('phone', values.phone);
    body.append('pin', pin);
    if (values.note.trim()) body.append('note', values.note);
    body.append('idPhoto', idPhoto, idPhoto.name || 'id.jpg');
    body.append('selfie', selfie, selfie.name || 'selfie.jpg');
    const r = await attempt(() => locals.api.upload('/auth/access-request', body), { values });
    if (!r.ok) return r.failure;
    return { sent: true, values };
  },
};
