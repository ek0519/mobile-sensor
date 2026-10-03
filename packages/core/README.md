# @mobile-sensor/core

Framework-independent sensor channels, device state, permission requests, browser lifecycle and detectors. See the repository README for the full public interface and demo.

```sh
npm install @mobile-sensor/core
```

## Unified collection and experimental behaviors

```ts
import { createMobileSensor, type MobileSensorOutput } from '@mobile-sensor/core';
const sensor = createMobileSensor();
const outputs: MobileSensorOutput[] = [];
sensor.onData(output => outputs.push(output));
// Call from a user gesture:
await sensor.requestPermission();
await sensor.start();
// Application handles batching/storage/upload, then calls sensor.destroy().
```

`MobileSensorOutput.kind` identifies `raw`, `gesture` or `behavior`. All outputs share `sessionId`, output `seq`, relative arrival time `t`, original epoch `timestamp`, and triggering raw `recordSeq`. Location is off by default. Core never uploads data. The engine estimates pickup, putdown, flip, handling and walking; confidence is an experimental detector score, not a calibrated probability. Raw recording, deterministic replay and motion feature extraction are also available. Framework SDKs expose the same factory plus React/Vue hooks and Svelte stores.
