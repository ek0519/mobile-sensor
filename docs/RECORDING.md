# Recording and Sensor Lab

Raw Sensor → normalized raw channel → Recorder → Session → explicit Lab Upload → Replay

The four npm packages work offline. Core never transmits data, requests permissions automatically, or starts sensors when a recorder is created. Recording types, features, replay and behaviors are SSR-safe. Device metadata is collected only by the browser Lab.

```ts
import { createSensors, createSensorRecorder, replaySensorRecording,
  createBehaviorEngine } from '@mobile-sensor/core';

const sensors = createSensors();
// Call in a click handler; invoke native iOS permission methods before awaiting.
await sensors.requestPermission();
await sensors.start();
const recorder = createSensorRecorder(sensors, { includeLocation: false });
recorder.start();
// Later, on stop:
const recording = recorder.stop();
const engine = createBehaviorEngine();
engine.on('pickup', event => console.log(event));
await replaySensorRecording(recording, {
  speed: 0, onRecord: record => engine.processSensorRecord(record),
});
engine.reset();
sensors.destroy();
```

Recorder subscribes without throttling and clones incoming samples. `timestamp` preserves the channel's original epoch timestamp, including the geolocation source timestamp. `t` is elapsed arrival time since recording started and never decreases; it is separate from the sensor timestamp. `seq` starts at zero and increases across all channels. Starting while active does nothing; restarting after stopping begins a new session. `clear()` detaches subscriptions and clears the session. `getRecords()` returns a defensive snapshot. The default 100,000-record limit stops recording and detaches subscriptions without losing retained data; the Lab reports this limit and saves the session.

Location requires both sensor acquisition opt-in (`sensors.start({ location: true })`) and recording opt-in (`includeLocation: true`). Lab defaults both to off and never uploads location records in a session without opt-in. Enabling location explicitly permits saving and uploading latitude/longitude as well as accuracy, speed and heading.

## Run the Lab

```sh
bun install
cp apps/lab/.env.example apps/lab/.env.local
# Set VITE_SENSOR_LAB_API to your server, then:
bun run dev:lab
bun run build:lab
```

Open the Lab through an HTTPS development proxy or HTTPS hosting on a phone. Vite's default dev server uses HTTP; localhost can be a secure context on desktop. The Lab rejects an HTTP API URL when the page uses HTTPS. The API server must allow CORS from the Lab origin. No server is needed for local recording, exporting or replay.

Enable Sensors → choose a label → Start Recording → perform action → Stop & Save. Recording is local until the explicit Stop & Save action. Failed uploads retain all records and allow Retry / Upload session, JSON export and NDJSON export. Device capabilities and actual live sensor states are displayed separately: support does not guarantee incoming samples.

The uploader sends POST `/v1/sessions` with schemaVersion, label, startedAt, includeLocation, device and capabilities; the returned server ID is used for POST `/v1/sessions/:id/records` and `/finish`. Local metadata IDs identify exports and are not sent as the server ID. Batches contain up to 200 records and flush at 1,000 ms or the batch threshold, whichever comes first. Stop flushes remaining batches before finish. Transient network errors, HTTP 408/429 and 5xx retry up to three total attempts; other HTTP errors fail immediately. Unsent batches stay buffered on failure. A server acceptance followed by a lost response can produce duplicate records or orphaned session creations; server-side sequence deduplication and idempotency are needed for exactly-once delivery. This client does not assume unspecified server idempotency support.

JSON exports contain metadata, startedAt, endedAt and records. NDJSON contains one raw record per line for analysis; it does not contain session metadata. Lab's replay loader accepts exported JSON (including metadata/records-only JSON) and validates record shape, schema version, opt-in and ordering. Files are limited to 60 MB and sessions to 100,000 records. Replay never uploads automatically.

Replay preserves input order. Speed 0 processes immediately without delays, 1 uses recording timing, 2 is twice as fast, and 0.5 is half speed. The first sample is delayed by its `t`; subsequent delays use relative differences. Async callbacks are awaited, so slow callbacks can extend wall-clock playback. Pass an AbortSignal to cancel. Reset the engine before each replay. Replay the same recording to create device-specific regression fixtures.
