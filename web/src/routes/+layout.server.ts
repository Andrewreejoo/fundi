import { env } from '$env/dynamic/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    lang: locals.lang,
    /** Browser-facing API base for photos (GET /files/:id). */
    fileBase: (env.PUBLIC_API_URL ?? env.API_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  };
};
