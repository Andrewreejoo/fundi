import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Shows a private ID photo or selfie to a signed-in admin. The API checks the admin role again. */
export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user?.roles?.includes('admin')) error(403, 'Admins only');
  const res = await locals.api.file(params.id);
  if (!res.ok) error(res.status === 404 ? 404 : 403, 'Not available');
  return new Response(res.body, {
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'private, no-store' },
  });
};
