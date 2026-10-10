import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { apiFor } from '$lib/server/api';

const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding', 'host'];

/**
 * /api/* is passed straight through to the API. This lets the site, the Android app, photo URLs and
 * the PayChangu webhook all use one public address (needed on hosts like Render's free tier, where
 * services cannot reach each other privately). The raw body is forwarded untouched so webhook
 * signatures still verify.
 */
async function proxyToApi(request: Request, url: URL) {
  const target = `${(env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '')}${url.pathname.slice(4) || '/'}${url.search}`;
  const headers = new Headers();
  request.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.includes(k.toLowerCase())) headers.set(k, v);
  });
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (!HOP_BY_HOP.includes(k.toLowerCase())) out.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: out });
}

export const handle: Handle = async ({ event, resolve }) => {
  const { url, request } = event;

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return proxyToApi(request, url);
  }

  // CSRF: SvelteKit's built-in check is relaxed in svelte.config.js so /api can receive uploads from the
  // app; the same rule is enforced here for every website form post.
  const type = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && FORM_TYPES.includes(type) && request.headers.get('origin') !== url.origin) {
    return new Response('Cross-site form submissions are forbidden', { status: 403 });
  }

  const secure = url.protocol === 'https:';
  event.locals.api = apiFor(event.cookies, event.fetch, secure);
  event.locals.secure = secure;
  event.locals.user = null;

  if (event.cookies.get('gm_at') || event.cookies.get('gm_rt')) {
    try {
      event.locals.user = await event.locals.api.get('/me');
    } catch {
      event.locals.user = null;
    }
  }

  return resolve(event);
};
