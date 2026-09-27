import type { SensorEnvironment } from '@mobile-sensors/core';
export function dispatch(target: EventTarget, type: string, data: object = {}) {
  target.dispatchEvent(Object.assign(new Event(type), data));
}
export function environment(): SensorEnvironment {
  return {
    window: Object.assign(new EventTarget(), {
      isSecureContext: true,
      DeviceMotionEvent: {}, DeviceOrientationEvent: {}, PointerEvent: {},
      innerWidth: 390, innerHeight: 844,
      visualViewport: Object.assign(new EventTarget(), { width: 390, height: 844, scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0 }),
    }),
    document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
    navigator: {},
  };
}
