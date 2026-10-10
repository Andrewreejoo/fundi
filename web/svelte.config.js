import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // Origin is checked in hooks.server.ts instead, so the /api pass-through can accept app uploads.
    csrf: { trustedOrigins: ['*'] },
  },
};
