import { readable } from 'svelte/store';
import type { Channel, Sensors, DetectorEvent, DetectorName } from '@mobile-sensors/core';
import type { Readable } from 'svelte/store';
export interface SamplingOptions { fps?: number }
export function sensorStore<T>(source: Channel<T>, options: SamplingOptions = {}): Readable<T> {
  const fps = options.fps ?? 10;
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError('fps must be finite and positive');
  return readable(source.getSnapshot(), set => source.subscribe(set, { throttle: 1000 / fps }));
}
export function createSensorStores(sensors: Sensors, options: SamplingOptions = {}) {
  const event = <T extends DetectorName>(name: T) => readable<DetectorEvent | null>(null, set => sensors.on(name, set));
  return {
    motion: sensorStore(sensors.motion, options), orientation: sensorStore(sensors.orientation, options), location: sensorStore(sensors.location, options),
    pointer: sensorStore(sensors.pointer, options), viewport: sensorStore(sensors.viewport, options), visibility: sensorStore(sensors.visibility, options),
    device: sensorStore(sensors.device, options), status: sensorStore(sensors.status, options), permissions: sensorStore(sensors.permissions, options),
    events: { shake: event('shake'), movement: event('movement'), stationary: event('stationary'), tilt: event('tilt'), rotation: event('rotation') },
  };
}
