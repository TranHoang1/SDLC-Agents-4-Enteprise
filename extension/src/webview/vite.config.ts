/**
 * SA4E-85 — Vite config for Svelte 4 Webview.
 * Outputs bundled JS/CSS to extension/out/webview/ for CSP-nonce loading.
 * Target: ≤15KB gzipped bundle.
 */

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, '../../out/webview'),
    emptyOutDir: true,
    // Single entry point for the webview app
    rollupOptions: {
      input: resolve(__dirname, 'main.ts'),
      output: {
        entryFileNames: 'main.js',
        assetFileNames: 'style.css',
        // No code splitting — single bundle for CSP nonce
        manualChunks: undefined,
      },
    },
    // Target ≤15KB gzipped
    minify: 'terser',
    sourcemap: false,
  },
  // Resolve Svelte store imports
  resolve: {
    alias: {
      '@stores': resolve(__dirname, 'stores'),
    },
  },
});
