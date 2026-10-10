import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') === 'resolved' ? 'resolved' : 'open';
  return { items: await locals.api.get(`/admin/disputes?status=${status}`), status };
};

export const actions: Actions = {
  resolve: async ({ locals, request }) => {
    const f = await request.formData();
    const resolution = String(f.get('resolution'));
    const r = await attempt(() =>
      locals.api.post(`/admin/disputes/${f.get('id')}/resolve`, {
        resolution,
        providerSharePercent: resolution === 'split' ? Number(f.get('share')) : undefined,
        note: String(f.get('note') ?? '').trim() || undefined,
      }),
    );
    return r.ok ? { done: 'Resolved' } : r.failure;
  },
};
