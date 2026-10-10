import { fail, redirect } from '@sveltejs/kit';
import { ApiError } from './api';

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(v: unknown, fallback = '/') {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : fallback;
}

/** Run an API call from a form action; API errors become a 400 with a readable message. */
export async function attempt<T>(fn: () => Promise<T>, extra: Record<string, unknown> = {}, opts: { showUnauthorized?: boolean } = {}) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (e) {
    if (e instanceof ApiError) {
      // A 401 normally means the session ran out. On the sign-in forms it means a wrong code or PIN: show it.
      if (e.status === 401 && !opts.showUnauthorized) redirect(303, '/login');
      return { ok: false as const, failure: fail(e.status === 429 ? 429 : 400, { error: e.message, ...extra }) };
    }
    throw e;
  }
}

export function requireUser(locals: App.Locals, url: URL) {
  if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  return locals.user;
}
