import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ root: new URL('.', import.meta.url).pathname, plugins: [svelte()], resolve: { alias: { '@mobile-sensor/core': new URL('../../packages/core/src/index.ts', import.meta.url).pathname }, dedupe:['svelte'] } });
