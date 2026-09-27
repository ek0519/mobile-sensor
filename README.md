# Mobile Sensors

A cross-framework TypeScript library for accessing browser sensors on mobile devices, with React, Vue, and Svelte adapters plus a live Svelte demo. The first release targets Web APIs available in iOS Safari; support for each feature is detected independently in other browsers.

**Live demo:** [Try the Mobile Sensors playground](https://ek0519.github.io/mobile-sensor/)

## Getting Started

Requirements: Bun 1.2+ (or a compatible workspace package manager) and Node.js 20+. Install dependencies from the project root:

```sh
bun install
bun run dev
```

Open the Vite URL on a phone connected to the same local network to try the simulated preview. Real motion sensors and geolocation require HTTPS. During development, use an HTTPS development certificate or a secure HTTPS tunnel. In iOS Safari, motion permission must be requested from a user-initiated button click.

## Packages

Run `bun run build` to generate ESM output and TypeScript declarations for all four packages. Each package can be packed independently. The package names are:

- `@mobile-sensor/core`: Framework-independent Browser Sensor APIs, permissions, lifecycle management, normalized data, and event detection.
- `@mobile-sensor/react`: React hooks; peer dependency: React 18 or 19.
- `@mobile-sensor/vue`: Vue composables; peer dependency: Vue 3.5+.
- `@mobile-sensor/svelte`: Svelte readable stores; peer dependency: Svelte 5.

The packages have not been published to npm. Before publishing, pack each package from its directory with `bun pm pack`, then install the resulting tarball in an application. Run `bun run test:pack` to verify package exports and declarations after installing all four tarballs in an isolated consumer project.

## Core Usage

```ts
import { createSensors } from '@mobile-sensor/core';

const sensors = createSensors();

button.addEventListener('click', async () => {
  // Keep this call inside the user gesture so iOS Safari can show its native permission prompt.
  await sensors.requestPermission({ motion: true, orientation: true });
  await sensors.start();
});

const stopMotionListener = sensors.motion.subscribe(motion => {
  if (motion) console.log(motion.acceleration, motion.rotationRate);
}, { throttle: 100 }); // Update this listener at most about 10 times per second.

const stopShakeListener = sensors.on('shake', event => {
  console.log(event.type, event.intensity);
});

const stopDirectionListener = sensors.on('direction', event => {
  console.log(event.direction); // up, down, left, right, rotate-left, rotate-right
});

const stopTiltListener = sensors.on('tilt-direction', event => {
  console.log(event.tiltDirection); // forward, backward, left, right
});

const stopLeftPress = sensors.on('left-press', event => {
  console.log('Left screen pressed by pointer', event.pointerId);
});
const stopRightPress = sensors.on('right-press', event => {
  console.log('Right screen pressed by pointer', event.pointerId);
});
const stopTouchState = sensors.device.subscribe(state => {
  if (state.leftPressed && state.rightPressed) console.log('Both sides are held');
});

// Location must be explicitly enabled.
await sensors.start({ location: true });

// Unsubscribe and release this instance's sensor resources when the page is done.
stopMotionListener();
stopShakeListener();
stopDirectionListener();
stopTiltListener();
stopLeftPress();
stopRightPress();
stopTouchState();
sensors.destroy();
```

Each channel exposes a stable `getSnapshot()` and `subscribe(handler, { throttle })`; subscribing returns an unsubscribe function. Missing values are `null`. The four channels are `motion`, `orientation`, `location`, and `pointer`. The library also provides `device` (combined device state), `status`, `permissions`, `capabilities()`, `on()`, and `start/pause/resume/stop/destroy`. The browser's page visibility lifecycle is handled internally to pause and resume active sensors; page visibility is not a public sensor channel.

Motion keeps its original X/Y/Z acceleration values and also emits `direction` events for up, down, left, right, rotate-left, and rotate-right. `shake` is a separate event. Orientation reports `tilt-direction` as forward, backward, left, or right, relative to the pose when testing starts. Other event names include `movement`, `stationary`, `tilt`, and `rotation`. Detection uses local heuristic thresholds configurable through `createSensors({ detectors: { ... } })`; these estimates can vary across devices and are not activity-recognition results.

Touch emits `left-press` and `right-press` when a pointer first presses each side of the viewport. A centered 100 CSS-pixel band is inactive. A pointer stays assigned to the side where it started until it is released; `device.leftPressed` and `device.rightPressed` report held state, so an application can derive a two-side hold without a separate combined event. Multiple pointers on one side keep that side pressed until the last pointer lifts. Touch events do not report physical pressing force.

## Framework Adapters

```tsx
import { useMotion } from '@mobile-sensor/react';
// React: subscribes through an external store, with a default update rate of 10 FPS.
const motion = useMotion(sensors, { fps: 8 });
```

```ts
import { useMotion } from '@mobile-sensor/vue';
// Vue: returns a readonly shallow ref created inside setup().
const motion = useMotion(sensors, { fps: 8 });
```

```svelte
<!-- Svelte 5: the store unsubscribes with the component's subscription lifecycle. -->
<script>
  import { createSensors } from '@mobile-sensor/core';
  import { createSensorStores } from '@mobile-sensor/svelte';
  const sensors = createSensors();
  const { motion } = createSensorStores(sensors);
</script>
<p>{$motion?.acceleration.x ?? 'Waiting for sensor data'}</p>
```

Adapters accept a core instance created and managed by the application. When a component unmounts, its own subscriptions are cleaned up; the shared sensor instance keeps running for other consumers.

## Checks and Tests

```sh
bun run test       # TDD behavior tests for core and all three adapters
bun run typecheck  # TypeScript and Svelte diagnostics
bun run build      # Package output and demo production build
bun run test:e2e   # Chromium demo interactions
bun run test:pack  # Install package tarballs in an isolated consumer project
```

See [docs/SENSORS.md](docs/SENSORS.md) for sensor fields and detector thresholds, and [docs/TDD.md](docs/TDD.md) for the red/green test log. Chromium automation does not replace testing on real iOS Safari and Android Chrome devices; permissions, hardware, and browser versions can affect the data available on each phone.
