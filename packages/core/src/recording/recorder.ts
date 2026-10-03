import type { Sensors } from '../index';
import type { SensorRecord, SensorRecorder, SensorRecorderOptions } from './types';
export function createSensorRecorder(sensors: Pick<Sensors, 'motion' | 'orientation' | 'pointer' | 'location'>, options: SensorRecorderOptions = {}): SensorRecorder {
  const max = options.maxRecords ?? 100_000;
  if (!Number.isInteger(max) || max < 1) throw new RangeError('maxRecords must be a positive integer');
  let records: SensorRecord[] = [], startedAt = 0, endedAt = 0, active = false;
  const subscriptions: (() => void)[] = [];
  function detach() { active = false; for (const unsubscribe of subscriptions.splice(0)) unsubscribe(); }
  return {
    start() {
      if (active) return;
      records = []; startedAt = Date.now(); endedAt = startedAt; active = true;
      for (const sensor of ['motion', 'orientation', 'pointer', 'location'] as const) {
        if (sensor === 'location' && !options.includeLocation) continue;
        subscriptions.push(sensors[sensor].subscribe(data => {
          if (!active || !data) return;
          records.push({ sensor, seq: records.length, t: Math.max(records.at(-1)?.t ?? 0, Date.now() - startedAt), timestamp: data.timestamp, data: structuredClone(data) } as SensorRecord);
          endedAt = Date.now();
          if (records.length >= max) detach();
        }));
      }
    },
    stop() { if (active) endedAt = Date.now(); detach(); return { startedAt, endedAt, records: structuredClone(records) }; },
    clear() { detach(); records = []; startedAt = endedAt = 0; },
    getRecords: () => structuredClone(records), isRecording: () => active,
  };
}
