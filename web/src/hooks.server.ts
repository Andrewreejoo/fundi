import type { Handle } from '@sveltejs/kit';
import { apiFor } from '$lib/server/api';
import { normalizeLang } from '$lib/i18n';

export const handle: Handle = async ({ event, resolve }) => {
  const secure = event.url.protocol === 'https:';
  event.locals.api = apiFor(event.cookies, event.fetch, secure);
  event.locals.secure = secure;
  event.locals.lang = normalizeLang(event.cookies.get('fundi_lang'));
  event.locals.user = null;

  if (event.cookies.get('fundi_at') || event.cookies.get('fundi_rt')) {
    try {
      event.locals.user = await event.locals.api.get('/me');
    } catch {
      event.locals.user = null;
    }
  }

  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.lang),
  });
};
