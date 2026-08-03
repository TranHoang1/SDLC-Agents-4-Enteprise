/**
 * SA4E-85 — Webview entry point.
 * Bootstraps the Svelte 4 app into the #app mount point.
 * Initializes message listener for Extension Host communication.
 */

import App from './App.svelte';
import { initMessageListener } from './messageListener';

// Mount Svelte app
const app = new App({
  target: document.getElementById('app')!,
});

// Start listening for Extension Host messages
initMessageListener();

export default app;
