import { loadListing } from '$lib/server/listing';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, locals, cookies }) => loadListing('sale', url, locals, cookies);
