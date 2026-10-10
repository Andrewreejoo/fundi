import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, locals }) => {
    const form = await request.formData();
    const lang = form.get('lang') === 'en' ? 'en' : 'ny';
    cookies.set('fundi_lang', lang, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: false, sameSite: 'lax' });
    if (locals.user) await locals.api.patch('/me', { language: lang }).catch(() => undefined);
    const next = String(form.get('next') || '/');
    redirect(303, next.startsWith('/') && !next.startsWith('//') ? next : '/');
  },
};
