import { env } from '$env/dynamic/private';
import type { Cookies } from '@sveltejs/kit';

const API = () => (env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

const ACCESS = 'gm_at';
const REFRESH = 'gm_rt';
const cookieOpts = (secure: boolean) => ({ path: '/', httpOnly: true, sameSite: 'lax' as const, secure });

export function storeTokens(cookies: Cookies, tokens: { accessToken: string; refreshToken: string }, secure: boolean) {
  cookies.set(ACCESS, tokens.accessToken, { ...cookieOpts(secure), maxAge: 60 * 15 });
  cookies.set(REFRESH, tokens.refreshToken, { ...cookieOpts(secure), maxAge: 60 * 60 * 24 * 30 });
}

export function clearTokens(cookies: Cookies) {
  cookies.delete(ACCESS, { path: '/' });
  cookies.delete(REFRESH, { path: '/' });
}

function messageOf(body: any, status: number) {
  const m = body?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string') return m;
  return status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed';
}

/**
 * Server-side API client bound to the visitor's cookies. Tokens never reach browser JavaScript:
 * they live in httpOnly cookies and are refreshed here when the access token expires.
 */
export function apiFor(cookies: Cookies, fetchFn: typeof fetch, secure = false) {
  async function raw(method: string, path: string, body?: unknown, isForm = false, retry = true): Promise<any> {
    const token = cookies.get(ACCESS);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
    const res = await fetchFn(`${API()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
    if (res.status === 401 && retry && cookies.get(REFRESH)) {
      const ok = await refresh();
      if (ok) return raw(method, path, body, isForm, false);
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) throw new ApiError(res.status, messageOf(json, res.status), json);
    return json;
  }

  async function refresh() {
    const rt = cookies.get(REFRESH);
    if (!rt) return false;
    const res = await fetchFn(`${API()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      clearTokens(cookies);
      return false;
    }
    storeTokens(cookies, await res.json(), secure);
    return true;
  }

  return {
    get: (p: string) => raw('GET', p),
    post: (p: string, b: unknown = {}) => raw('POST', p, b),
    patch: (p: string, b: unknown = {}) => raw('PATCH', p, b),
    put: (p: string, b: unknown = {}) => raw('PUT', p, b),
    del: (p: string) => raw('DELETE', p),
    upload: (p: string, form: FormData) => raw('POST', p, form, true),
    /** Stream a file (e.g. a private ID photo) through the site with the visitor's token. */
    file: async (id: string) => {
      const token = cookies.get(ACCESS);
      return fetchFn(`${API()}/files/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    },
    refresh,
  };
}

export type Api = ReturnType<typeof apiFor>;
