/**
 * SA4E-85 — Svelte 4 compiler configuration.
 * Optimized for VSCode webview bundle size constraint (≤15KB gz).
 */

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // CSS injected into JS for single-file output
    css: 'injected',
  },
};
