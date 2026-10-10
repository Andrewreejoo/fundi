import { env } from '$env/dynamic/private';
import { catalog } from '$lib/server/catalog';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { settings } = await catalog(locals.api).catch(() => ({ settings: {} as any }));
  return {
    user: locals.user,
    lang: locals.lang,
    demo: !!settings?.demo,
    /** Browser-facing base for photos (GET /files/:id). Defaults to this site's /api pass-through. */
    fileBase: (env.PUBLIC_API_URL || '/api').replace(/\/$/, ''),
  };
};
