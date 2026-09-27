import { build } from 'esbuild';
import { $ } from 'bun';
for (const name of ['core','react','vue','svelte']) {
  await build({ entryPoints: [`packages/${name}/src/index.ts`], outdir: `packages/${name}/dist`, entryNames: 'index', format: 'esm', platform: 'browser', target: 'es2022', bundle: true, packages: 'external' });
}
for (const name of ['core','react','vue','svelte']) await $`bunx tsc --project packages/${name}/tsconfig.build.json`;
console.info('Built ESM entry points and declarations for all four packages.');
