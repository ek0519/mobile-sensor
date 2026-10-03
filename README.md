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

For local package development, run `bun pm pack` in a package directory to create a tarball. Run `bun run test:pack` to verify all four tarballs in an isolated consumer project.

## Core Usage

```sh
bun add @mobile-sensor/core
```

For a browser page with buttons named `enable-sensors` and `enable-location`:

```ts
import { createSensors } from '@mobile-sensor/core';

const sensors = createSensors();
const button = document.querySelector<HTMLButtonElement>('#enable-sensors')!;
const locationButton = document.querySelector<HTMLButtonElement>('#enable-location')!;

async function enableSensors() {
  // Keep this call inside the user gesture so iOS Safari can show its native permission prompt.
  await sensors.requestPermission({ motion: true, orientation: true });
  await sensors.start();
}
button.addEventListener('click', enableSensors);

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

// Location must be explicitly enabled through a separate action.
async function enableLocation() {
  await sensors.start({ location: true });
}
locationButton.addEventListener('click', enableLocation);

// Call this from your application's teardown lifecycle.
function dispose() {
  button.removeEventListener('click', enableSensors);
  locationButton.removeEventListener('click', enableLocation);
  stopMotionListener();
  stopShakeListener();
  stopDirectionListener();
  stopTiltListener();
  stopLeftPress();
  stopRightPress();
  stopTouchState();
  sensors.destroy();
}
```

Each channel exposes a stable `getSnapshot()` and `subscribe(handler, { throttle })`; subscribing returns an unsubscribe function. Missing values are `null`. The four channels are `motion`, `orientation`, `location`, and `pointer`. The library also provides `device` (combined device state), `status`, `permissions`, `capabilities()`, `on()`, and `start/pause/resume/stop/destroy`. The browser's page visibility lifecycle is handled internally to pause and resume active sensors; page visibility is not a public sensor channel.

Motion keeps its original X/Y/Z acceleration values and also emits `direction` events for up, down, left, and right. It estimates `rotate-left` and `rotate-right` from a coherent circular X/Y acceleration trace: from the screen-facing view, clockwise is right and counterclockwise is left. The separate `rotation` event reports angular-rate magnitude; it does not determine circle direction. `shake` is a separate event. Orientation reports `tilt-direction` as forward, backward, left, or right, relative to the pose when testing starts. Other event names include `movement` and `stationary`. Detection uses local heuristic thresholds configurable through `createSensors({ detectors: { ... } })`; these estimates can vary across devices and are not activity-recognition results.

Touch emits `left-press` and `right-press` when a pointer first presses each side of the viewport. A centered 100 CSS-pixel band is inactive. A pointer stays assigned to the side where it started until it is released; `device.leftPressed` and `device.rightPressed` report held state, so an application can derive a two-side hold without a separate combined event. Multiple pointers on one side keep that side pressed until the last pointer lifts. Touch events do not report physical pressing force.

## Framework Adapters

### React

```sh
bun add @mobile-sensor/core @mobile-sensor/react
```

Pass an application-owned core instance to the component. Hooks subscribe through `useSyncExternalStore` and return the latest sampled value.

```tsx
import type { Sensors } from '@mobile-sensor/core';
import { useMotion, useDeviceState, useSensor } from '@mobile-sensor/react';

export function MotionPanel({ sensors }: { sensors: Sensors }) {
  const motion = useMotion(sensors, { fps: 10 });
  const device = useDeviceState(sensors);
  const status = useSensor(sensors.status);

  async function enable() {
    await sensors.requestPermission(); // Called directly from the click handler.
    await sensors.start();
  }

  return (
    <section>
      <button onClick={enable}>Enable sensors</button>
      <p>Status: {status.motion.state}</p>
      <p>X: {motion?.acceleration.x ?? 'Unknown'} m/s²</p>
      <p>Direction: {device.direction ?? 'Waiting'}</p>
    </section>
  );
}
```

| Export | Usage and return value |
|---|---|
| `useSensor(channel, options?)` | Subscribe to any core channel; returns its sampled snapshot. Use this for pointer, status, and permissions as well as custom channel selection. |
| `useMotion(sensors, options?)` | Returns `MotionData \| null`. |
| `useOrientation(sensors, options?)` | Returns `OrientationData \| null`. |
| `useLocation(sensors, options?)` | Returns `LocationData \| null`; enable location separately with `start({ location: true })`. |
| `useDeviceState(sensors, options?)` | Returns the combined `DeviceState`, including direction and held touch zones. |
| `SamplingOptions` | Exported type for `{ fps?: number }`. |

Call hooks at the top level of a component. Snapshots stay stable between updates; the hook captures an initial server snapshot for SSR. Unmounting removes the component's subscriptions.

### Vue

```sh
bun add @mobile-sensor/core @mobile-sensor/vue
```

Composables return readonly shallow refs. Read `.value` in script; Vue unwraps them in templates.

```vue
<script setup lang="ts">
import type { Sensors } from '@mobile-sensor/core';
import { useMotion, useDeviceState, useSensor } from '@mobile-sensor/vue';

const props = defineProps<{ sensors: Sensors }>();
const motion = useMotion(props.sensors, { fps: 10 });
const device = useDeviceState(props.sensors);
const status = useSensor(props.sensors.status);

async function enable() {
  await props.sensors.requestPermission();
  await props.sensors.start();
}
</script>

<template>
  <button @click="enable">Enable sensors</button>
  <p>Status: {{ status.motion.state }}</p>
  <p>X: {{ motion?.acceleration.x ?? 'Unknown' }} m/s²</p>
  <p>Direction: {{ device.direction ?? 'Waiting' }}</p>
</template>
```

| Export | Usage and return value |
|---|---|
| `useSensor(channel, options?)` | Returns `Readonly<ShallowRef<T>>` for any core channel, including pointer, status, and permissions. |
| `useMotion(sensors, options?)` | Readonly ref containing `MotionData \| null`. |
| `useOrientation(sensors, options?)` | Readonly ref containing `OrientationData \| null`. |
| `useLocation(sensors, options?)` | Readonly ref containing `LocationData \| null`; location remains opt-in. |
| `useDeviceState(sensors, options?)` | Readonly ref containing `DeviceState`. |
| `SamplingOptions` | Exported type for `{ fps?: number }`. |

Call composables synchronously inside component `setup()`. They subscribe on mount and unsubscribe when the component scope is disposed. Keep the supplied instance stable for that component's lifetime; a later prop replacement does not rebind these composables.

### Svelte

```sh
bun add @mobile-sensor/core @mobile-sensor/svelte
```

Readable stores integrate with Svelte's `$store` syntax, which manages component subscriptions automatically.

```svelte
<script lang="ts">
  import type { Sensors } from '@mobile-sensor/core';
  import { createSensorStores } from '@mobile-sensor/svelte';

  let { sensors }: { sensors: Sensors } = $props();
  const { motion, device, status, events } = createSensorStores(sensors, { fps: 10 });
  const shake = events.shake;

  async function enable() {
    await sensors.requestPermission();
    await sensors.start();
  }
</script>

<button onclick={enable}>Enable sensors</button>
<p>Status: {$status.motion.state}</p>
<p>X: {$motion?.acceleration.x ?? 'Unknown'} m/s²</p>
<p>Direction: {$device.direction ?? 'Waiting'}</p>
<p>Last shake intensity: {$shake?.intensity ?? 'None'}</p>
```

| Export | Usage and return value |
|---|---|
| `sensorStore(channel, options?)` | Converts one core channel to a `Readable<T>`. For example, `sensorStore(sensors.pointer)` exposes the latest pointer sample. |
| `createSensorStores(sensors, options?)` | Returns readable stores named `motion`, `orientation`, `location`, `pointer`, `device`, `status`, and `permissions`, plus `events`. |
| `createSensorStores(...).events` | Stores named `shake`, `movement`, `stationary`, `tilt`, and `rotation`. Each starts as `null` and retains the latest event received while subscribed. |
| `SamplingOptions` | Exported type for `{ fps?: number }`. |

Stores attach when their first subscriber arrives and detach after the last subscriber leaves. Keep the supplied instance stable, or recreate the stores when replacing it. For events without a built-in event store—`direction`, `tilt-direction`, `screen-face`, `left-press`, and `right-press`—use the core `on()` method and call its returned unsubscribe function during cleanup.

### Shared adapter behavior

All adapters accept `{ fps }`, defaulting to `10`. It must be a finite positive number; this controls channel notifications using a throttle interval of `1000 / fps` milliseconds. It does not change browser sampling or detector processing. Svelte event stores receive events without this channel throttle.

The application creates one instance with `createSensors()` and shares it with its components. Adapters neither request permission nor start, stop, or destroy that instance. Component cleanup removes only its subscriptions; the owner calls `destroy()` when the instance is no longer needed. Core event listeners added through `on()` require their own cleanup.

Imports are SSR-safe. Create the hardware-connected instance in the browser and pass it into the sensor UI; an instance created on the server captures an unavailable environment and does not become browser-connected during hydration.

## Core API Reference

### Instance configuration

`createSensors(options?: SensorOptions): Sensors` creates an independent instance without starting listeners.

| Option | Default | Meaning |
|---|---|---|
| `location` | `false` | Enable location when the instance starts. Can be changed by `start({ location })`. |
| `detectors` | Built-in thresholds | A `Partial<DetectorOptions>` overriding the detector settings below. |
| `environment` | Current browser environment | Supply a `SensorEnvironment` to inject browser boundaries for tests/simulation, or `null` for an unavailable environment. |

### Permissions and lifecycle

| Method | Result and behavior |
|---|---|
| `capabilities()` | Returns booleans for `motion`, `orientation`, `location`, and `pointer`. API presence does not guarantee permission or usable data. |
| `requestPermission({ motion?, orientation? }?)` | Returns `Promise<Permissions>`. With no argument, requests both. When an object is supplied, only entries set to `true` are requested. Call directly inside a user gesture, before unrelated asynchronous work. |
| `start({ location? }?)` | Returns `Promise<void>`. Starts available, permitted sources. Repeated starts avoid duplicate listeners. `location: true` starts geolocation and its browser permission flow; `false` stops its watch. Resolution does not mean data has arrived. |
| `pause()` | Temporarily detaches listeners and location watches, resets detector state, and cancels pending notifications. |
| `resume()` | Resumes a previously started instance. It does not restart an instance after `stop()`. |
| `stop()` | Stops sources and lifecycle listeners and invalidates pending permission results. Existing subscribers remain available for a later `start()`. |
| `destroy()` | Permanently stops the instance, removes subscribers and event handlers, and clears timers. Create a new instance to use sensors again. |
| `on(name, handler)` | Registers a detector event handler and returns an unsubscribe function. Events are processed at the incoming sensor rate, before UI throttling. |

The core pauses active sources when the page is hidden and resumes them when visible unless manually paused or stopped. Raw channel snapshots retain their latest readings after pause/stop; use `status` to determine whether a source is running.

### Channels and data

Every channel implements `Channel<T>`:

```ts
const current = sensors.motion.getSnapshot();
const unsubscribe = sensors.motion.subscribe(next => {
  console.log(next);
}, { throttle: 100 });

// When this consumer is finished:
unsubscribe();
```

`getSnapshot()` returns the current value without subscribing. `subscribe()` receives future updates; it does not immediately emit the initial snapshot. `throttle` defaults to `0` and is a finite, non-negative interval in milliseconds. When updates arrive during the interval, the latest pending value is delivered at its end. Unsubscribing cancels that subscriber's pending timer.

| Channel | Snapshot and fields |
|---|---|
| `motion` | `MotionData \| null`: `acceleration` and `accelerationIncludingGravity` contain X/Y/Z in m/s²; `rotationRate` contains alpha/beta/gamma in °/s; `interval` is the browser-reported sample interval in ms. |
| `orientation` | `OrientationData \| null`: alpha/beta/gamma angles in degrees and `absolute`, indicating the browser's absolute-reference flag. |
| `location` | `LocationData \| null`: latitude/longitude in degrees, accuracy/altitude/altitudeAccuracy in meters, speed in m/s, and heading in degrees. |
| `pointer` | `PointerData \| null`: the latest pointer's `pointerId`, `pointerType`, viewport X/Y in CSS pixels, browser-reported `pressure`, and `phase` (`down`, `move`, `up`, `cancel`). Touch Events are used as a fallback. This is a latest-sample channel, not an array of active touches. |
| `device` | `DeviceState`: combined detector state described below. |
| `status` | A `Status` map keyed by sensor name. Each entry contains `state`, `error`, and `updatedAt` (last active update time, or `null`). |
| `permissions` | A `Permissions` map for motion, orientation, and location. Values are `unknown`, `granted`, `denied`, `not-required`, `unsupported`, or `error`. |

Raw data snapshots contain `timestamp` in milliseconds since the Unix epoch. Missing measurements stay `null`. Status states are `unsupported`, `permission-required`, `denied`, `idle`, `waiting`, `active`, `paused`, `stopped`, and `error`. `active` means the source delivered an event; individual fields can still be `null`.

### Combined device state

| Field | Meaning |
|---|---|
| `direction` | `up`, `down`, `left`, `right`, `rotate-left`, `rotate-right`, or `null`. Circular directions use the screen-facing convention described above. |
| `tiltDirection` | `forward`, `backward`, `left`, `right`, or `null`, relative to the initial valid pose after start/resume. |
| `screenFace` | `front` for screen up, `back` for screen down, `edge` for upright/steeply tilted, or `null` when unknown. Uses a world-up projection above 0.7 or below -0.7 and 50 ms of consistent samples. |
| `tilting`, `rotating`, `moving`, `stationary`, `shaking` | Boolean detector states, or `null` without sufficient/current evidence. `rotating` refers to angular-rate magnitude. |
| `movementIntensity` | Linear acceleration magnitude in m/s², or `null`. |
| `leftPressed`, `rightPressed` | Boolean held-zone states. Both may be `true`; the center 100 CSS pixels are inactive. |

### Detector events

All events include `type`, `source`, and `timestamp`. Motion/orientation events also include `intensity`. Touch press events provide `pointerId` instead of intensity. Use `device` for current state, including release/reset transitions; events announce detections and do not replay to new subscribers.

| Event name | Source | Trigger and additional fields |
|---|---|---|
| `direction` | motion | A linear direction pulse or coherent circular trace; `direction` contains the label and intensity is acceleration in m/s². |
| `shake` | motion | Opposing high-acceleration peaks; intensity in m/s². |
| `movement` | motion | Sustained acceleration above the movement threshold; intensity in m/s². |
| `stationary` | motion | Sustained low acceleration; intensity in m/s². |
| `rotation` | motion | Angular-rate magnitude crosses the activation threshold; intensity in °/s. |
| `tilt` | orientation | Change from the initial pose crosses the tilt threshold; intensity in degrees. |
| `tilt-direction` | orientation | A detected tilt direction changes; `tiltDirection` supplies the label, intensity in degrees. |
| `screen-face` | orientation | A stable face classification changes; `screenFace` supplies the label. Intensity is the absolute world-up projection from 0 to 1. |
| `left-press` | pointer | Left zone changes from unpressed to pressed; includes the initiating `pointerId`. |
| `right-press` | pointer | Right zone changes from unpressed to pressed; includes the initiating `pointerId`. |

```ts
const off = sensors.on('direction', event => {
  console.log(event.direction, event.intensity, event.timestamp);
});
// Call off() when this event consumer is disposed.
```

### Detector options

```ts
const sensors = createSensors({
  detectors: { shakeThreshold: 14, shakeCooldown: 1200, tiltThreshold: 25 },
});
```

| Option | Default | Meaning |
|---|---|---|
| `shakeThreshold` | `12` m/s² | Minimum magnitude for opposing shake peaks. |
| `shakeWindow` | `500` ms | Maximum time between opposing peaks. |
| `shakeCooldown` | `1000` ms | Minimum interval between shake detections; the visible shake state lasts at least 100 ms. |
| `movementThreshold` | `1.5` m/s² | Minimum magnitude for a movement candidate. |
| `movementDuration` | `150` ms | Required sustained movement evidence. |
| `stationaryThreshold` | `0.8` m/s² | Maximum magnitude for a stationary candidate. |
| `stationaryDuration` | `800` ms | Required sustained stationary evidence. |
| `staleAfter` | `1000` ms | Timeout for derived state without fresh relevant readings; also the displayed direction lifetime. |
| `tiltThreshold` / `tiltRelease` | `20` / `15` degrees | Tilt activation and release thresholds. |
| `rotationThreshold` / `rotationRelease` | `30` / `20` °/s | Angular-rate activation and release thresholds. |
| `directionThreshold` | `2.5` m/s² | Dominant X/Y pulse threshold for linear directions; a neutral period rearms detection. |
| `directionCooldown` | `400` ms | Cooldown used by direction detection. Circular detections track their own last-circle time. |
| `circleAccelerationThreshold` | `0.8` m/s² | Minimum X/Y vector magnitude for a circle trace. |
| `circleSweepThreshold` | `300` degrees | Required net angular sweep of the acceleration vector. |
| `circleMinSamples` | `10` | Minimum changing-angle steps in the trace. |
| `circleWindow` | `2500` ms | Maximum duration of one trace. |

All values must be finite and non-negative. `staleAfter`, `directionThreshold`, `circleAccelerationThreshold`, and `circleWindow` must be positive. `movementThreshold` must exceed `stationaryThreshold`; release thresholds cannot exceed activation thresholds. `circleSweepThreshold` must be greater than 180 and at most 360; `circleMinSamples` must be an integer of at least 8. Invalid settings throw `RangeError`.

Circle recognition also requires at least 75% directional consistency. A gap exceeding the smaller of 500 ms and `circleWindow`, missing X/Y data, or low vector magnitude resets the trace. These are heuristic device gestures, not position tracking or human activity classification.

### TypeScript exports

Core exports `Sensors`, `SensorOptions`, `SensorEnvironment`, `PermissionConstructor`, `Channel<T>`, `SubscriptionOptions`, `Unsubscribe`, `Vector3`, `MotionData`, `OrientationData`, `LocationData`, `PointerData`, `SensorName`, `SensorState`, `SensorStatus`, `Status`, `Capabilities`, `PermissionState`, `Permissions`, `DeviceState`, `MotionDirection`, `TiltDirection`, `ScreenFace`, `DetectorName`, `DetectorEvent`, and `DetectorOptions`. Import these with `import type` when annotating shared instances, snapshots, handlers, or configuration.

## Checks and Tests

```sh
bun run test       # TDD behavior tests for core and all three adapters
bun run typecheck  # TypeScript and Svelte diagnostics
bun run build      # Package output and demo production build
bun run test:e2e   # Chromium demo interactions
bun run test:pack  # Install package tarballs in an isolated consumer project
```

See [docs/SENSORS.md](docs/SENSORS.md) for sensor fields and detector thresholds, and [docs/TDD.md](docs/TDD.md) for the red/green test log. Chromium automation does not replace testing on real iOS Safari and Android Chrome devices; permissions, hardware, and browser versions can affect the data available on each phone.

## Research architecture

```text
Raw Sensors
    ↓
Normalized Channels → Recorder → local Session → optional Lab upload / Replay
    ↓
Features
    ↓
Detectors
    ↓
Behaviors (Experimental)
```

Sensor Lab (`bun run dev:lab`) is a Svelte 5 development tool for labeled raw recordings, local JSON/NDJSON exports, replay and experimental behavior inspection. The existing demo remains available with `bun run dev`. Library packages work completely offline; the Sensor Lab server is optional. Upload happens only after an explicit Lab action, and location recording is off by default. See [recording and Lab setup](docs/RECORDING.md) and [experimental behavior estimates](docs/BEHAVIORS.md).

## Unified raw data and inference stream

Use `createMobileSensor` to automatically feed raw channels into the behavior engine and subscribe to one serializable output stream. Uploading, batching and storage remain application responsibilities. Existing `createSensors`, recorder and behavior engine APIs remain available.

```ts
import { createMobileSensor, type MobileSensorOutput } from '@mobile-sensor/core';

const sensor = createMobileSensor(); // location off by default
const pending: MobileSensorOutput[] = [];
const unsubscribe = sensor.onData(output => pending.push(output));

// In an Enable button click handler:
await sensor.requestPermission();
await sensor.start();
// Your application can batch/serialize pending and send it to its own backend.
// Later: unsubscribe(); sensor.destroy();
```

`MobileSensorOutput.kind` is `raw`, `gesture` or `behavior`; TypeScript narrows `data` accordingly. Every output includes `schemaVersion`, `sessionId`, `seq`, `recordSeq`, `t` and `timestamp`. See [the unified output contract](docs/UNIFIED-API.md).
