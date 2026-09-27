import type { SensorEnvironment } from '@mobile-sensor/core';
export function dispatch(target: EventTarget, type: string, data: object = {}) {
  target.dispatchEvent(Object.assign(new Event(type), data));
}
export function environment(): SensorEnvironment {
  return {
    window: Object.assign(new EventTarget(), {
      isSecureContext: true,
      DeviceMotionEvent: {}, DeviceOrientationEvent: {}, PointerEvent: {},
      innerWidth: 390,
    }),
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    navigator: {},
  };
}
