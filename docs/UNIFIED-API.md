# Unified collection and inference API

`createMobileSensor()` owns raw collection and an experimental behavior engine. `onData()` receives all outputs without UI throttling. It creates no upload requests and stores no complete session in memory. Applications can serialize or batch outputs for their own backend.

```ts
import { createMobileSensor, type MobileSensorOutput } from '@mobile-sensor/core';
const sensor = createMobileSensor({
  location: false,
  behaviors: { walking: { minPeriodicity: 0.7 } },
});
const batch: MobileSensorOutput[] = [];
const unsubscribe = sensor.onData(output => {
  batch.push(output);
  if (output.kind === 'raw') console.log(output.data.sensor);
  else console.log(output.data.type);
});
// Invoke this from a user click, keeping iOS native permission calls in the gesture.
async function enable() {
  await sensor.requestPermission();
  await sensor.start({ sessionId: 'your-session-id' });
}
// Application decides when/how to send JSON.stringify({ outputs: batch }).
// unsubscribe(); sensor.stop(); sensor.destroy();
```

## Output contract

`MobileSensorOutput` is a discriminated union:

```ts
type MobileSensorOutput = {
  schemaVersion: 1;
  sessionId: string;
  seq: number;
  recordSeq: number;
  t: number;
  timestamp: number;
} & (
  | { kind: 'raw'; data: SensorRecord }
  | { kind: 'gesture'; data: DetectorEvent }
  | { kind: 'behavior'; data: BehaviorEvent }
);
```

- `sessionId`: supplied on start, or generated using crypto.randomUUID(). The same value links raw and inferred data. Restarting after stop creates a new session; starting an active instance does not create another session.
- `seq`: zero-based output sequence across all three kinds, increasing for the complete session.
- `recordSeq`: zero-based raw sample sequence. Gesture and behavior outputs identify their triggering raw sample. It equals `data.seq` on raw outputs.
- `t`: monotonically nondecreasing arrival time in milliseconds since start. Pausing preserves session identity and elapsed time; resume can therefore have a time gap.
- `timestamp`: original sample epoch timestamp. Geolocation source timestamps can predate arrival. Inferred events use their triggering sample timestamp.
- `data`: existing public SensorRecord, DetectorEvent or BehaviorEvent format. Confidence is an experimental detector score, not a calibrated probability.

For each raw sample, the engine runs automatically, then outputs the raw record followed by any detected gestures or behaviors. A raw sample may produce zero, one or several events; this is a stream rather than a requirement to put an inference on every sample. Consumers can group all outputs by `sessionId` and `recordSeq` or send mixed kinds in one batch. Low-level motion/orientation gestures come from the engine; pointer left/right presses use the live sensor's viewport-aware detector. Their outputs follow the pointer raw sample.

Subscribers receive independent copies. Callbacks run synchronously; buffer locally and perform asynchronous network work separately to avoid blocking sensor delivery. Keep local buffers bounded in your application. An unsubscribe function detaches that consumer. `stop()` detaches internal raw subscriptions, resets inference and stops acquisition; `destroy()` also clears consumers. Engine evidence resets when manually paused or when sensor status pauses on page visibility changes. The output session continues after resume.

Creation and start remain SSR-safe; no browser environment produces no samples. Creation/start never request motion/orientation permission automatically. Call `requestPermission()` from a user gesture. Location is excluded by default and starts only after an explicit `{ location: true }` option, which can also be disabled during an active session. Native channels, permissions, status, device state, capabilities and existing `on(name, callback)` remain exposed on the same instance. Native `on()` and unified gesture outputs are alternative subscription paths; subscribing to both can produce duplicate application observations.

Use the separate recording/replay APIs for stored recordings. Raw outputs contain the existing SensorRecord format and can be collected into a recording for offline replay. Existing React, Vue and Svelte APIs remain compatible. The factory and output types are now also re-exported by all three SDKs. React and Vue offer `useMobileSensor(source, onData?)`; Svelte offers `createMobileSensorStores(source)` with `output` and `onData`. These adapters unsubscribe their consumers without stopping a shared source. For complete collection use callbacks or synchronous subscribers, since UI updates may be coalesced. See each SDK README for framework examples.
