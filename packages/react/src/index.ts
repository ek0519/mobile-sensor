import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Channel, Sensors, MobileSensor, MobileSensorOutput } from '@mobile-sensor/core';
export interface SamplingOptions { fps?: number }
export function useSensor<T>(source: Channel<T>, options: SamplingOptions = {}): T {
  const fps = options.fps ?? 10;
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('fps must be finite and positive');
  const store = useMemo(() => {
    let snapshot = source.getSnapshot();
    const serverSnapshot = snapshot;
    return {
      getSnapshot: () => snapshot,
      getServerSnapshot: () => serverSnapshot,
      subscribe(notify: () => void) {
        snapshot = source.getSnapshot();
        const off = source.subscribe(value => { snapshot = value; notify(); }, { throttle: 1000 / fps });
        notify();
        return off;
      },
    };
  }, [source, fps]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
export const useMotion = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.motion, options);
export const useOrientation = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.orientation, options);
export const useLocation = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.location, options);
export const useDeviceState = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.device, options);

export { createMobileSensor } from '@mobile-sensor/core';
export type { MobileSensor, MobileSensorOptions, MobileSensorStartOptions, MobileSensorOutput, MobileSensorEvent } from '@mobile-sensor/core';

/** Subscribe to the unified stream. Use onData for lossless buffering, not render effects. */
export function useMobileSensor(source: MobileSensor, onData?: (output: MobileSensorOutput) => void): MobileSensorOutput | null {
  const store = useMemo(() => {
    let snapshot: MobileSensorOutput | null = null;
    return {
      getSnapshot: () => snapshot,
      getServerSnapshot: () => null,
      subscribe(notify: () => void) {
        return source.onData(output => { snapshot = output; notify(); });
      },
    };
  }, [source]);
  useEffect(() => onData ? source.onData(onData) : undefined, [source, onData]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
