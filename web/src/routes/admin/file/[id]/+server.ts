import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Streams private files (ID photos, selfies) to admins, using their session token. */
export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user?.roles.includes('admin')) error(403, 'Admins only');
  const res = await locals.api.file(params.id);
  if (!res.ok) error(res.status, 'File not found');
  return new Response(res.body, {
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream', 'Cache-Control': 'private, no-store' },
  });
};
