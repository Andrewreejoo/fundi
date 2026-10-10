import { env } from '$env/dynamic/private';
import { catalog, readIds } from '$lib/server/catalog';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  const { settings } = await catalog(locals.api).catch(() => ({ settings: {} as any }));
  return {
    user: locals.user,
    demo: !!settings?.demo,
    compareCount: readIds(cookies.get('gm_compare'), 4).length,
    /** Browser-facing base for photos (GET /files/:id). Defaults to this site's /api pass-through. */
    fileBase: (env.PUBLIC_API_URL || '/api').replace(/\/$/, ''),
  };
};
