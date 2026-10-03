import { createSensors } from './index';
import { createBehaviorEngine } from './behaviors';
import type { BehaviorDetectorOptions, BehaviorEvent, BehaviorName } from './behaviors';
import type { DetectorEvent, SensorOptions, Unsubscribe } from './types';
import type { SensorRecord } from './recording/types';

export interface MobileSensorOptions extends SensorOptions {
  behaviors?: BehaviorDetectorOptions;
}
export interface MobileSensorStartOptions { location?: boolean; sessionId?: string }
interface OutputBase {
  schemaVersion: 1;
  sessionId: string;
  /** Monotonically increasing sequence across raw samples and inferred events. */
  seq: number;
  /** Elapsed sample arrival time in milliseconds within this session. */
  t: number;
  /** Original epoch timestamp in milliseconds. */
  timestamp: number;
}
export type MobileSensorEvent =
  | { kind: 'gesture'; data: DetectorEvent }
  | { kind: 'behavior'; data: BehaviorEvent };
/** Serializable output; recordSeq links each inference to its triggering raw sample. */
export type MobileSensorOutput = OutputBase & (
  | { kind: 'raw'; recordSeq: number; data: SensorRecord }
  | (MobileSensorEvent & { recordSeq: number })
);

/** Collect raw samples and experimental inferences through one local output stream. */
export function createMobileSensor(options: MobileSensorOptions = {}) {
  const sensors = createSensors(options);
  const engine = createBehaviorEngine({ ...options.behaviors, detectors: { ...options.detectors, ...options.behaviors?.detectors } });
  const listeners = new Set<(output: MobileSensorOutput) => void>();
  const cleanups: Unsubscribe[] = [];
  let active = false, destroyed = false, sessionId = '', startedAt = 0;
  let seq = 0, recordSeq = 0, lastT = 0, generation = 0;
  let locationEnabled = options.location ?? false;
  let current: SensorRecord | null = null;
  let collected: MobileSensorEvent[] = [];
  const behaviorNames: BehaviorName[] = ['pickup', 'putdown', 'flip', 'handling', 'walking'];
  engine.onDetector(data => collected.push({ kind: 'gesture', data }));
  for (const name of behaviorNames) engine.on(name, data => collected.push({ kind: 'behavior', data }));

  function emit(event: { kind: 'raw'; data: SensorRecord } | MobileSensorEvent, record: SensorRecord, expectedGeneration = generation) {
    if (!active || destroyed || generation !== expectedGeneration) return;
    const output: MobileSensorOutput = {
      schemaVersion: 1, sessionId, seq: seq++, t: record.t,
      timestamp: record.timestamp, recordSeq: record.seq, ...event,
    };
    // Callers can buffer/mutate their copy without altering inference or other subscribers.
    for (const listener of [...listeners]) {
      if (!active || destroyed || generation !== expectedGeneration) break;
      listener(structuredClone(output));
    }
  }
  function attach() {
    for (const sensor of ['motion', 'orientation', 'pointer', 'location'] as const) {
      cleanups.push(sensors[sensor].subscribe(data => {
        if (!active || !data || (sensor === 'location' && !locationEnabled)) return;
        lastT = Math.max(lastT, Date.now() - startedAt);
        const record = { sensor, seq: recordSeq++, t: lastT, timestamp: data.timestamp, data: structuredClone(data) } as SensorRecord;
        const sampleGeneration = generation;
        current = record; collected = [];
        engine.processSensorRecord(record);
        const events = collected;
        emit({ kind: 'raw', data: record }, record, sampleGeneration);
        for (const event of events) emit(event, record, sampleGeneration);
      }));
    }
    // Pointer press detectors depend on viewport geometry and live in createSensors.
    for (const name of ['left-press', 'right-press'] as const) {
      cleanups.push(sensors.on(name, data => {
        if (current?.sensor === 'pointer' && current.timestamp === data.timestamp) emit({ kind: 'gesture', data }, current);
      }));
    }
    cleanups.push(sensors.status.subscribe(status => {
      if (Object.values(status).some(s => s.state === 'paused')) engine.reset();
    }));
  }
  function stop() {
    active = false; generation++;
    for (const cleanup of cleanups.splice(0)) cleanup();
    engine.reset(); current = null; collected = [];
    sensors.stop();
  }
  return {
    ...sensors,
    onData(listener: (output: MobileSensorOutput) => void): Unsubscribe {
      if (destroyed) return () => {};
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start(startOptions: MobileSensorStartOptions = {}) {
      if (destroyed) return Promise.resolve();
      if (startOptions.location !== undefined) locationEnabled = startOptions.location;
      if (!active) {
        sessionId = startOptions.sessionId ?? globalThis.crypto.randomUUID();
        startedAt = Date.now(); seq = recordSeq = lastT = 0;
        engine.reset(); active = true; attach();
      }
      return sensors.start({ location: locationEnabled });
    },
    pause() { engine.reset(); sensors.pause(); },
    stop,
    destroy() { if (destroyed) return; stop(); destroyed = true; listeners.clear(); sensors.destroy(); },
  };
}
export type MobileSensor = ReturnType<typeof createMobileSensor>;
