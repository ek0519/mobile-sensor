import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
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
  for (const name of ['core','react','vue','svelte']) {
    const pkg = JSON.parse(await readFile(join(temp, 'node_modules', '@solitudo-studio', name, 'package.json'), 'utf8'));
    if (!pkg.exports?.['.']?.import || !pkg.exports?.['.']?.types) throw new Error(`Missing JS/type exports for ${name}`);
    await readFile(join(temp, 'node_modules', '@solitudo-studio', name, 'dist', 'index.js'));
    await readFile(join(temp, 'node_modules', '@solitudo-studio', name, 'dist', 'index.d.ts'));
  }
  await writeFile(join(temp, 'consumer.mjs'), "import { createSensors } from '@solitudo-studio/core'; import { useSensor } from '@solitudo-studio/react'; import { useMotion as useVueMotion } from '@solitudo-studio/vue'; import { createSensorStores } from '@solitudo-studio/svelte'; if (![createSensors,useSensor,useVueMotion,createSensorStores].every(x => typeof x === 'function')) throw new Error('Public import unavailable'); console.log('All four packed packages import and expose ESM plus declarations.');");
  await $`bun run consumer.mjs`.cwd(temp);
  await writeFile(join(temp, 'consumer.ts'), "import { createSensors } from '@solitudo-studio/core'; import { useSensor } from '@solitudo-studio/react'; import { useMotion as useVueMotion } from '@solitudo-studio/vue'; import { createSensorStores } from '@solitudo-studio/svelte'; const sensors = createSensors(); useSensor(sensors.motion); useVueMotion(sensors).value; createSensorStores(sensors).motion.subscribe(value => value?.acceleration.x); ");
  await $`${process.execPath} ${root}/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler ${join(temp, 'consumer.ts')}`.cwd(temp);
  console.log('Packed JavaScript imports and consumer TypeScript declarations compile.');
} finally { await rm(temp, { recursive: true, force: true }); }
