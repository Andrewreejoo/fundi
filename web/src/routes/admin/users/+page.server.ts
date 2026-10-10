import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const phone = url.searchParams.get('phone') ?? '';
  return { phone, list: await locals.api.get(`/admin/users${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`) };
};

export const actions: Actions = {
  status: async ({ locals, request }) => {
    const f = await request.formData();
    const to = f.get('to') === 'suspend' ? 'suspend' : 'activate';
    const r = await attempt(() => locals.api.post(`/admin/users/${f.get('id')}/${to}`));
    return r.ok ? { ok: true } : r.failure;
  },
};
