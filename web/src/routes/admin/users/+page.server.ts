import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const phone = url.searchParams.get('phone') ?? '';
  return { items: await locals.api.get(`/admin/users${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`), phone };
};

export const actions: Actions = {
  status: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/users/${f.get('id')}/${f.get('to') === 'suspended' ? 'suspend' : 'activate'}`));
    return r.ok ? { done: 'Updated' } : r.failure;
  },
  role: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/users/${f.get('id')}/roles`, { role: f.get('role'), op: f.get('op') }));
    return r.ok ? { done: 'Role updated' } : r.failure;
  },
};
