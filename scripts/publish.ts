import { $ } from 'bun';
import { readFile } from 'node:fs/promises';

const registry = 'https://registry.npmjs.org';
const packages = await Promise.all(['core', 'react', 'vue', 'svelte'].map(async directory => {
  const manifest = JSON.parse(await readFile(`packages/${directory}/package.json`, 'utf8')) as {
    name: string; version: string; dependencies?: Record<string, string>;
  };
  return { directory, ...manifest };
}));
const core = packages[0]!;
for (const pkg of packages) {
  if (pkg.version !== core.version || (pkg.directory !== 'core' && pkg.dependencies?.[core.name] !== core.version)) {
    throw new Error('All SDK versions and core dependencies must match before publishing');
  }
}
const auth = await $`npm whoami --registry ${registry}`.quiet().nothrow();
if (auth.exitCode !== 0) throw new Error('npm authentication is unavailable. Run npm login --auth-type=web, then retry.');
for (const pkg of packages) {
  const spec = `${pkg.name}@${pkg.version}`;
  const existing = await $`npm view ${spec} version --json --prefer-online --registry ${registry}`.quiet().nothrow();
  if (existing.exitCode === 0) {
    if (JSON.parse(existing.stdout.toString()) !== pkg.version) throw new Error(`Unexpected registry version for ${spec}`);
    console.info(`Already published: ${spec}`);
    continue;
  }
  if (!/E404/.test(existing.stderr.toString() + existing.stdout.toString())) throw new Error(`Registry lookup failed for ${spec}; stopping without publishing`);
  console.info(`Publishing ${spec}`);
  // Preserve the user's terminal for npm browser/passkey/OTP authentication.
  const publish = Bun.spawn(['npm', 'publish', '--access', 'public', '--registry', registry], {
    cwd: `packages/${pkg.directory}`, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
  });
  if (await publish.exited !== 0) throw new Error(`Publishing failed for ${spec}; retry after npm verification`);
}
console.info(`All four packages published at ${core.version}.`);
