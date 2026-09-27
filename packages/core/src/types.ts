export type Unsubscribe = () => void;
export interface SubscriptionOptions { throttle?: number }
export interface Channel<T> { getSnapshot(): T; subscribe(handler: (value: T) => void, options?: SubscriptionOptions): Unsubscribe }
export interface Vector3 { x: number | null; y: number | null; z: number | null }
export interface MotionData { timestamp: number; acceleration: Vector3; accelerationIncludingGravity: Vector3; rotationRate: { alpha: number | null; beta: number | null; gamma: number | null }; interval: number | null }
export interface PermissionConstructor { requestPermission?: () => Promise<string> }
export interface SensorEnvironment {
  window: EventTarget & {
    isSecureContext?: boolean;
    DeviceMotionEvent?: PermissionConstructor; DeviceOrientationEvent?: PermissionConstructor; PointerEvent?: unknown; ontouchstart?: unknown;
    innerWidth: number; innerHeight: number;
    visualViewport?: (EventTarget & { width: number; height: number; scale: number; offsetLeft: number; offsetTop: number; pageLeft: number; pageTop: number }) | null;
  };
  document: EventTarget & { visibilityState: string };
  navigator: { geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch'> };
}
export interface SensorOptions { environment?: SensorEnvironment | null; location?: boolean; detectors?: Partial<DetectorOptions> }
export type SensorName = 'motion' | 'orientation' | 'location' | 'pointer' | 'viewport' | 'visibility';
export type SensorState = 'unsupported' | 'permission-required' | 'denied' | 'idle' | 'waiting' | 'active' | 'paused' | 'stopped' | 'error';
export interface SensorStatus { state: SensorState; error: string | null; updatedAt: number | null }
export type Status = Record<SensorName, SensorStatus>;
export type Capabilities = Record<SensorName, boolean>;
export interface OrientationData { timestamp: number; alpha: number | null; beta: number | null; gamma: number | null; absolute: boolean }
export interface LocationData { timestamp: number; latitude: number; longitude: number; accuracy: number; altitude: number | null; altitudeAccuracy: number | null; speed: number | null; heading: number | null }
export interface PointerData { timestamp: number; pointerId: number; pointerType: string; x: number | null; y: number | null; pressure: number | null; phase: 'down' | 'move' | 'up' | 'cancel' }
export interface ViewportData { timestamp: number; width: number; height: number; scale: number; offsetLeft: number; offsetTop: number; pageLeft: number; pageTop: number }


export type PermissionState = 'unknown' | 'granted' | 'denied' | 'not-required' | 'unsupported' | 'error';
export type Permissions = Record<'motion' | 'orientation' | 'location', PermissionState>;

export type DetectorName = 'shake' | 'movement' | 'stationary' | 'tilt' | 'rotation';
export interface DetectorEvent { type: DetectorName; source: 'motion' | 'orientation'; timestamp: number; intensity: number }
export interface DetectorOptions { shakeThreshold: number; shakeWindow: number; shakeCooldown: number; movementThreshold: number; stationaryThreshold: number; movementDuration: number; stationaryDuration: number; staleAfter: number; tiltThreshold: number; tiltRelease: number; rotationThreshold: number; rotationRelease: number }

export interface DeviceState { tilting: boolean | null; rotating: boolean | null; moving: boolean | null; stationary: boolean | null; shaking: boolean | null; movementIntensity: number | null }
