import type { SensorRecord } from './types';
export interface ReplayOptions { speed?: number; onRecord(record: SensorRecord): void | Promise<void>; signal?: AbortSignal }
export async function replaySensorRecording(recording: { records: readonly SensorRecord[] }, options: ReplayOptions): Promise<void> {
  const speed = options.speed ?? 1;
  if (!Number.isFinite(speed) || speed < 0) throw new RangeError('speed must be finite and non-negative');
  let previous = 0;
  for (const record of recording.records) {
    options.signal?.throwIfAborted();
    const delay = speed === 0 ? 0 : Math.max(0, record.t - previous) / speed;
    if (delay) await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(options.signal?.reason); };
      const timer = setTimeout(() => { options.signal?.removeEventListener('abort', abort); resolve(); }, delay);
      options.signal?.addEventListener('abort', abort, { once: true });
    });
    options.signal?.throwIfAborted();
    await options.onRecord(record); previous = record.t;
  }
}
