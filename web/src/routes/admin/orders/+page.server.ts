import { attempt } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const status = url.searchParams.get('status') ?? '';
  const [disputes, orders] = await Promise.all([
    locals.api.get('/admin/disputes?status=open'),
    locals.api.get(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  ]);
  return { status, disputes, orders };
};

export const actions: Actions = {
  resolve: async ({ locals, request }) => {
    const f = await request.formData();
    const resolution = String(f.get('resolution'));
    const r = await attempt(() =>
      locals.api.post(`/admin/disputes/${f.get('id')}/resolve`, {
        resolution,
        sellerSharePercent: resolution === 'split' ? Number(f.get('share')) : undefined,
        note: String(f.get('note') ?? '').trim() || undefined,
      }),
    );
    return r.ok ? { ok: true } : r.failure;
  },
};
