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
    innerWidth: number;
  };
  document: EventTarget & { visibilityState: string };
  navigator: { geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch'> };
}
export interface SensorOptions { environment?: SensorEnvironment | null; location?: boolean; detectors?: Partial<DetectorOptions> }
export type SensorName = 'motion' | 'orientation' | 'location' | 'pointer';
export type SensorState = 'unsupported' | 'permission-required' | 'denied' | 'idle' | 'waiting' | 'active' | 'paused' | 'stopped' | 'error';
export interface SensorStatus { state: SensorState; error: string | null; updatedAt: number | null }
export type Status = Record<SensorName, SensorStatus>;
export type Capabilities = Record<SensorName, boolean>;
export interface OrientationData { timestamp: number; alpha: number | null; beta: number | null; gamma: number | null; absolute: boolean }
export interface LocationData { timestamp: number; latitude: number; longitude: number; accuracy: number; altitude: number | null; altitudeAccuracy: number | null; speed: number | null; heading: number | null }
export interface PointerData { timestamp: number; pointerId: number; pointerType: string; x: number | null; y: number | null; pressure: number | null; phase: 'down' | 'move' | 'up' | 'cancel' }
export type PermissionState = 'unknown' | 'granted' | 'denied' | 'not-required' | 'unsupported' | 'error';
export type Permissions = Record<'motion' | 'orientation' | 'location', PermissionState>;

export type MotionDirection = 'up' | 'down' | 'left' | 'right' | 'rotate-left' | 'rotate-right';
export type ScreenFace = 'front' | 'back' | 'edge';
export type TiltDirection = 'forward' | 'backward' | 'left' | 'right';
export type DetectorName = 'screen-face' | 'shake' | 'movement' | 'stationary' | 'tilt' | 'tilt-direction' | 'rotation' | 'direction' | 'left-press' | 'right-press';
export type DetectorEvent =
  | { type: Exclude<DetectorName, 'left-press' | 'right-press'>; source: 'motion' | 'orientation'; timestamp: number; intensity: number; direction?: MotionDirection; tiltDirection?: TiltDirection; screenFace?: ScreenFace; pointerId?: never }
  | { type: 'left-press' | 'right-press'; source: 'pointer'; timestamp: number; pointerId: number; intensity?: undefined; direction?: never; screenFace?: never; tiltDirection?: never };
export interface DetectorOptions { shakeThreshold: number; shakeWindow: number; shakeCooldown: number; movementThreshold: number; stationaryThreshold: number; movementDuration: number; stationaryDuration: number; staleAfter: number; tiltThreshold: number; tiltRelease: number; rotationThreshold: number; rotationRelease: number; directionThreshold: number; circleAccelerationThreshold: number; circleSweepThreshold: number; circleMinSamples: number; circleWindow: number; directionCooldown: number }

export interface DeviceState { screenFace: ScreenFace | null; tilting: boolean | null; tiltDirection: TiltDirection | null; rotating: boolean | null; moving: boolean | null; stationary: boolean | null; shaking: boolean | null; movementIntensity: number | null; direction: MotionDirection | null; leftPressed: boolean; rightPressed: boolean }
