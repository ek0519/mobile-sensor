import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';
const root = process.cwd(); const temp = await mkdtemp(join(tmpdir(), 'mobile-sensor-consumer-'));
try {
  const paths: string[] = [];
  for (const name of ['core','react','vue','svelte']) {
    const output = await $`cd ${root}/packages/${name} && bun pm pack --destination ${temp}`.text();
    const filename = output.split('\n').find(line => line.includes('.tgz'))?.trim();
    if (!filename) throw new Error(`No tarball created for ${name}: ${output}`);
    paths.push(filename);
  }
  await $`npm install --no-audit --no-fund ${paths}`.cwd(temp);
  for (const name of ['@mobile-sensor/core','@mobile-sensor/react','@mobile-sensor/vue','@mobile-sensor/svelte']) {
    const pkg = JSON.parse(await readFile(join(temp, 'node_modules', name, 'package.json'), 'utf8'));
    if (!pkg.exports?.['.']?.import || !pkg.exports?.['.']?.types) throw new Error(`Missing JS/type exports for ${name}`);
    await readFile(join(temp, 'node_modules', name, 'dist', 'index.js'));
    await readFile(join(temp, 'node_modules', name, 'dist', 'index.d.ts'));
  }
  await writeFile(join(temp, 'consumer.mjs'), "import { createSensors } from '@mobile-sensor/core'; import { useSensor } from '@mobile-sensor/react'; import { useMotion as useVueMotion } from '@mobile-sensor/vue'; import { createSensorStores } from '@mobile-sensor/svelte'; if (![createSensors,useSensor,useVueMotion,createSensorStores].every(x => typeof x === 'function')) throw new Error('Public import unavailable'); const sensors = createSensors(); const stores = createSensorStores(sensors); if ('viewport' in sensors || 'visibility' in sensors || 'viewport' in stores || 'visibility' in stores) throw new Error('Removed channels remain in the public API'); const core = await import('@mobile-sensor/core'); const react = await import('@mobile-sensor/react'); const vue = await import('@mobile-sensor/vue'); const svelte = await import('@mobile-sensor/svelte'); if (![core.createMobileSensor,react.createMobileSensor,react.useMobileSensor,vue.createMobileSensor,vue.useMobileSensor,svelte.createMobileSensor,svelte.createMobileSensorStores].every(x => typeof x === 'function')) throw new Error('Unified SDK API missing'); const mobile = core.createMobileSensor({environment:null}); await mobile.start(); mobile.destroy(); console.log('All four packed packages expose legacy and unified APIs, including SSR-safe collection.');");
  await $`bun run consumer.mjs`.cwd(temp);
  await writeFile(join(temp, 'consumer.ts'), "import { createSensors } from '@mobile-sensor/core'; import { useSensor } from '@mobile-sensor/react'; import { useMotion as useVueMotion } from '@mobile-sensor/vue'; import { createSensorStores } from '@mobile-sensor/svelte'; const sensors = createSensors(); useSensor(sensors.motion); useVueMotion(sensors).value; createSensorStores(sensors).motion.subscribe(value => value?.acceleration.x);\n// @ts-expect-error viewport is not a public sensor channel\nsensors.viewport;\n// @ts-expect-error visibility is not a public sensor channel\nsensors.visibility;\nimport { createMobileSensor, type MobileSensorOutput } from '@mobile-sensor/core';\nimport { useMobileSensor as useReactMobile } from '@mobile-sensor/react';\nimport { useMobileSensor as useVueMobile } from '@mobile-sensor/vue';\nimport { createMobileSensorStores } from '@mobile-sensor/svelte';\nconst mobile = createMobileSensor({environment:null});\nconst receive = (output: MobileSensorOutput) => { if (output.kind === 'raw') output.data.sensor; else output.data.type; };\nuseReactMobile(mobile,receive)?.kind; useVueMobile(mobile,receive).value?.kind; createMobileSensorStores(mobile).output.subscribe(value => value?.kind);\n");
  await $`${process.execPath} ${root}/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler ${join(temp, 'consumer.ts')}`.cwd(temp);
  console.log('Packed JavaScript imports and consumer TypeScript declarations compile.');
} finally { await rm(temp, { recursive: true, force: true }); }
