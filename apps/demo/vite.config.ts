import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  base: process.env.GITHUB_ACTIONS === 'true' && !process.env.GITHUB_PAGES_CUSTOM_DOMAIN ? '/mobile-sensor/' : '/',
  plugins: [svelte()],
  server: { host: '0.0.0.0' },
  resolve: { dedupe: ['svelte'] },
});
