import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ root: new URL('.', import.meta.url).pathname, plugins: [svelte()], server: { host: '0.0.0.0' }, resolve: { dedupe: ['svelte'] } });
