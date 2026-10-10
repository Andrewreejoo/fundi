import { catalog } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => ({ settings: (await catalog(locals.api)).settings });
