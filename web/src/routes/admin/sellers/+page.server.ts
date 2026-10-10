import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const q = url.searchParams.get('q') ?? '';
  return { q, list: await locals.api.get(`/admin/sellers${q ? `?q=${encodeURIComponent(q)}` : ''}`) };
};

export const actions: Actions = {
  verify: async ({ locals, request }) => {
    const f = await request.formData();
    const r = await attempt(() => locals.api.post(`/admin/sellers/${f.get('id')}/verify`, { on: f.get('on') === 'true' }));
    return r.ok ? { ok: true } : r.failure;
  },
};
