# Experimental behaviors

Raw Sensor → Feature → Detector / Gesture → Behavior

For example: acceleration XYZ → magnitude / variance → movement / stationary → pickup.

Raw channels preserve normalized browser sensor values. Features are reusable mathematical summaries. Existing detectors retain their names, events and public API. Behaviors estimate multi-sample activity from low-level evidence and feature windows. Walking, pickup, putdown and handling are heuristic activity estimates, not OS-level activity recognition. Results vary across devices, browsers, sampling rates and holding styles. Confidence is a bounded detector score, not a scientifically calibrated probability.

```ts
import { createBehaviorEngine, extractMotionWindowFeatures } from '@mobile-sensor/core';
const engine = createBehaviorEngine({
  pickup: { minDuration: 300, maxDuration: 2500, orientationThreshold: 20 },
  putdown: { stationaryDuration: 700, maxDuration: 4000, impactThreshold: 3 },
  walking: { windowMs: 3000, minFrequency: 1, maxFrequency: 3,
    minPeriodicity: 0.65, minVariance: 0.15, cooldown: 2000 },
  handling: { windowMs: 1200, minEvidence: 3 },
  flip: { maxDuration: 2000 },
});
const unsubscribe = engine.on('walking', event => console.log(event));
const detachDetector = engine.onDetector(event => console.log(event));
// Supply ordered SensorRecords from the recorder or replay.
engine.processSensorRecord(record);
const features = extractMotionWindowFeatures(records, { windowMs: 2000 });
unsubscribe(); detachDetector(); engine.reset();
```

All decisions use relative record time and no DOM APIs. The engine reuses existing low-level detector logic with wall-clock expiration timers disabled, so playback speed does not change results. The original live sensors retain their expiration timers. Handling timeouts and sequence expiry are evaluated when the next record arrives; an idle stream must supply a later sample to emit an inactive handling event. `reset()` clears all evidence but preserves listeners. Events use the original record epoch timestamp. Feed records in nondecreasing `t` order; out-of-order records are rejected.

## Initial heuristics

- Flip: stable front/back screen-face transitions within 2 seconds, allowing edge in between. Score 0.85 represents rule evidence.
- Pickup: confirmed stationary baseline, sustained movement, orientation/tilt change, then at least 150 ms reduced movement; total duration 300–2500 ms. Score 0.8.
- Putdown: sustained movement, orientation change, a subsequent impact of at least 3 m/s², then 700 ms stationary samples, within 4 seconds. Score 0.8. Pickup gets precedence where the same sequence fits both rules.
- Handling: at least three recent motion, rotation, tilt or pointer evidence samples, separated by 80 ms, within 1.2 seconds. Events include `metadata.active` true/false. This means recent device motion or interaction, not proof a human holds the phone. Score 0.7.
- Walking: at least 20 samples spanning 2 seconds in a rolling 3-second window, dominant frequency 1–3 Hz, periodicity at least 0.65, magnitude variance at least 0.15 and peak-count consistency at least 0.6. The score averages periodicity and peak consistency. Repeated walking events have a 2-second cooldown. This frequency band is an initial candidate, not a calibrated threshold.

`detectors` options customize low-level movement, stationary, tilt and rotation thresholds; `pickup`, `putdown`, `walking`, `handling` and `flip` configure behavior thresholds centrally. Motion activity and reduced-motion evidence use the configured low-level movement/stationary boundaries (defaults 1.5/0.8 m/s²). `pickup.reducedMovementDuration` and `handling.evidenceInterval` configure the confirmation duration and evidence spacing. These are experimental defaults.

## Features

`vectorMagnitude` returns null for incomplete or non-finite vectors. Window extraction excludes unavailable acceleration/rotation samples from numeric statistics. `sampleCount` counts motion records, including those with unavailable vectors. Empty statistics are null. Variance is population variance; RMS is root mean square. Rotation magnitude uses alpha/beta/gamma rates. Peak count counts local maxima above the mean. Dominant frequency and periodicity are unavailable until at least 16 valid samples span 1.5 seconds with nonzero variance.

Frequency estimation performs a small deterministic least-squares sinusoidal scan from 0.5–5 Hz in 0.05 Hz steps on actual sample times; periodicity is explained signal energy clamped to 0–1. It adds no heavyweight dependencies. It is sensitive to noise, short windows, undersampling and periodic non-walking actions. Use real labeled device recordings to calibrate and test before relying on estimates.
