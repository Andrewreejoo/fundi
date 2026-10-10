import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/forms';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = requireUser(locals, url);
  if (!user.roles.includes('admin')) error(403, 'Admins only');
  return {};
};
