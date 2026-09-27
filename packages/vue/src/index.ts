import { shallowRef, shallowReadonly, onScopeDispose, onMounted } from 'vue';
import type { ShallowRef } from 'vue';
import type { Channel, Sensors } from '@mobile-sensors/core';
export interface SamplingOptions { fps?: number }
export function useSensor<T>(source: Channel<T>, options: SamplingOptions = {}): Readonly<ShallowRef<T>> {
  const fps = options.fps ?? 10;
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('fps must be finite and positive');
  const state = shallowRef<T>(source.getSnapshot());
  let unsubscribe: (() => void) | undefined;
  onMounted(() => {
    state.value = source.getSnapshot();
    unsubscribe = source.subscribe(value => { state.value = value; }, { throttle: 1000 / fps });
  });
  onScopeDispose(() => unsubscribe?.());
  return shallowReadonly(state);
}
export const useMotion = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.motion, options);
export const useOrientation = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.orientation, options);
export const useLocation = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.location, options);
export const useDeviceState = (sensors: Sensors, options?: SamplingOptions) => useSensor(sensors.device, options);
