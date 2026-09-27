import { detectors } from './detectors';
import { channel } from './channel';
import type { MotionData, SensorEnvironment, SensorOptions, SensorName, SensorState, Status, Capabilities, OrientationData, LocationData, PointerData, Permissions, DetectorName, DetectorEvent, DeviceState } from './types';
export type * from './types';
const names: SensorName[] = ['motion', 'orientation', 'location', 'pointer'];
export function createSensors(options: SensorOptions = {}) {
  const env = options.environment === undefined ? browserEnvironment() : options.environment;
  const capabilities: Capabilities = { motion: !!env?.window.DeviceMotionEvent, orientation: !!env?.window.DeviceOrientationEvent, location: !!env?.navigator.geolocation, pointer: !!(env?.window.PointerEvent || (env && 'ontouchstart' in env.window)) };
  const motion = channel<MotionData | null>(null);
  const orientation = channel<OrientationData | null>(null);
  const location = channel<LocationData | null>(null);
  const pointer = channel<PointerData | null>(null);
  const eventHandlers = new Map<DetectorName, Set<(event: DetectorEvent) => void>>();
  const device = channel<DeviceState>({ tilting: null, tiltDirection: null, rotating: null, moving: null, stationary: null, shaking: null, movementIntensity: null, direction: null, leftPressed: false, rightPressed: false });
  const detector = detectors(options.detectors ?? {}, event => { for (const handler of [...(eventHandlers.get(event.type) ?? [])]) handler(event); }, patch => device.publish({ ...device.api.getSnapshot(), ...patch }));
  const activePointers = new Map<number, 'left' | 'right'>();
  const constructors = { motion: env?.window.DeviceMotionEvent, orientation: env?.window.DeviceOrientationEvent };
  const permissions = channel<Permissions>({ motion: !capabilities.motion ? 'unsupported' : constructors.motion?.requestPermission ? 'unknown' : 'not-required', orientation: !capabilities.orientation ? 'unsupported' : constructors.orientation?.requestPermission ? 'unknown' : 'not-required', location: capabilities.location ? 'unknown' : 'unsupported' });
  const status = channel<Status>(Object.fromEntries(names.map(name => [name, { state: !capabilities[name] ? 'unsupported' : (name === 'motion' || name === 'orientation') && permissions.api.getSnapshot()[name] === 'unknown' ? 'permission-required' : 'idle', error: null, updatedAt: null }])) as Status);
  const channels = [motion, orientation, location, pointer, device, status, permissions];
  const cleanups: Array<() => void> = [];
  let running = false;
  let wanted = false;
  let manuallyPaused = false;
  let destroyed = false;
  let generation = 0;
  let permissionGeneration = 0;
  let lifecycleAttached = false;
  let pageHidden = false;
  const lifecycleCleanups: Array<() => void> = [];
  let locationEnabled = options.location ?? false;
  let watchId: number | undefined;
  function setStatus(name: SensorName, state: SensorState, error: string | null = null) {
    status.publish({ ...status.api.getSnapshot(), [name]: { state, error, updatedAt: state === 'active' ? Date.now() : status.api.getSnapshot()[name].updatedAt } });
  }
  function listen(target: EventTarget, type: string, fn: (e: Event) => void) {
    target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn));
  }
  function publishPress(side: 'left' | 'right', pressed: boolean, pointerId: number, timestamp: number) {
    const current = device.api.getSnapshot();
    const key = side === 'left' ? 'leftPressed' : 'rightPressed';
    if (current[key] === pressed) return;
    device.publish({ ...current, [key]: pressed });
    if (pressed) {
      const event: DetectorEvent = { type: side === 'left' ? 'left-press' : 'right-press', source: 'pointer', timestamp, pointerId };
      for (const handler of [...(eventHandlers.get(event.type) ?? [])]) handler(event);
    }
  }
  function releasePointer(pointerId: number, timestamp: number) {
    const side = activePointers.get(pointerId);
    if (!side) return;
    activePointers.delete(pointerId);
    publishPress(side, [...activePointers.values()].includes(side), pointerId, timestamp);
  }
  function releaseAllPointers() {
    activePointers.clear();
    const current = device.api.getSnapshot();
    if (current.leftPressed || current.rightPressed) device.publish({ ...current, leftPressed: false, rightPressed: false });
  }
  function publishPointer(input: { pointerId: number; pointerType: string; clientX: number | null; clientY: number | null; pressure: number | null }, phase: PointerData['phase']) {
    const timestamp = Date.now();
    pointer.publish({ timestamp, pointerId: input.pointerId, pointerType: input.pointerType, x: input.clientX, y: input.clientY, pressure: input.pressure, phase });
    if (phase === 'down') {
      releasePointer(input.pointerId, timestamp);
      if (input.clientX !== null && env) {
        const middle = env.window.innerWidth / 2;
        if (input.clientX < middle - 50) {
          activePointers.set(input.pointerId, 'left'); publishPress('left', true, input.pointerId, timestamp);
        } else if (input.clientX > middle + 50) {
          activePointers.set(input.pointerId, 'right'); publishPress('right', true, input.pointerId, timestamp);
        }
      }
    } else if (phase === 'up' || phase === 'cancel') releasePointer(input.pointerId, timestamp);
    setStatus('pointer', 'active');
  }
  function requestPermission(request: { motion?: boolean; orientation?: boolean } = { motion: true, orientation: true }) {
    const requestGeneration = permissionGeneration;
    if (destroyed) return Promise.resolve(permissions.api.getSnapshot());
    // Invoke both native methods before the first await to preserve transient user activation.
    const jobs = (['motion', 'orientation'] as const).filter(name => request[name]).map(name => {
      const ctor = constructors[name];
      if (env?.window.isSecureContext === false) { setStatus(name, 'error', 'HTTPS secure context required'); return Promise.resolve(); }
      if (!capabilities[name] || !ctor?.requestPermission) return Promise.resolve();
      let response: Promise<string>;
      try { response = ctor.requestPermission(); } catch (error) { response = Promise.reject(error); }
      return response.then(value => {
        if (destroyed || requestGeneration !== permissionGeneration) return;
        const permission = value === 'granted' ? 'granted' : 'denied';
        permissions.publish({ ...permissions.api.getSnapshot(), [name]: permission });
        setStatus(name, permission === 'granted' ? 'idle' : 'denied');
      }, error => { if (destroyed || requestGeneration !== permissionGeneration) return; permissions.publish({ ...permissions.api.getSnapshot(), [name]: 'error' }); setStatus(name, 'error', String(error)); });
    });
    return Promise.all(jobs).then(() => { if (!destroyed && wanted && !manuallyPaused && running) { detach('paused'); attach(); } return permissions.api.getSnapshot(); });
  }
  function allowed(name: 'motion' | 'orientation') { if (env?.window.isSecureContext === false) { setStatus(name, 'error', 'HTTPS secure context required'); return false; } const p = permissions.api.getSnapshot()[name]; return p === 'granted' || p === 'not-required'; }
  function startLocation() {
    if (!env?.navigator.geolocation || !locationEnabled || watchId !== undefined) return;
    if (env.window.isSecureContext === false) { setStatus('location', 'error', 'HTTPS secure context required'); return; }
    setStatus('location', 'waiting');
    const currentGeneration = generation;
    try { watchId = env.navigator.geolocation.watchPosition(position => {
      if (!running || generation !== currentGeneration) return;
      permissions.publish({ ...permissions.api.getSnapshot(), location: 'granted' });
      const c = position.coords;
      location.publish({ timestamp: position.timestamp, latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy, altitude: numeric(c.altitude), altitudeAccuracy: numeric(c.altitudeAccuracy), speed: numeric(c.speed), heading: numeric(c.heading) });
      setStatus('location', 'active');
    }, error => { if (running && generation === currentGeneration) { if (error.code === 1) permissions.publish({ ...permissions.api.getSnapshot(), location: 'denied' }); setStatus('location', error.code === 1 ? 'denied' : 'error', error.message); } });
    } catch (error) { setStatus('location', 'error', String(error)); }
  }
  async function start(startOptions: { location?: boolean } = {}) {
    if (destroyed) return;
    if (startOptions.location !== undefined) {
      locationEnabled = startOptions.location;
      if (!locationEnabled && watchId !== undefined) { env?.navigator.geolocation?.clearWatch(watchId); watchId = undefined; generation++; setStatus('location', 'stopped'); }
    }
    const preservePause = wanted && manuallyPaused;
    wanted = true; if (!preservePause) manuallyPaused = false;
    ensureLifecycle(); attach();
  }
  function attach() {
    if (!env || destroyed || !wanted || manuallyPaused || pageHidden || env.document.visibilityState === 'hidden') return;
    if (running) { startLocation(); return; }
    running = true;
    if (capabilities.motion && allowed('motion')) {
      setStatus('motion', 'waiting');
      listen(env.window, 'devicemotion', event => {
        const data = event as unknown as Partial<MotionData>;
        const normalized: MotionData = { timestamp: Date.now(), acceleration: vector(data.acceleration), accelerationIncludingGravity: vector(data.accelerationIncludingGravity), rotationRate: { alpha: numeric(data.rotationRate?.alpha), beta: numeric(data.rotationRate?.beta), gamma: numeric(data.rotationRate?.gamma) }, interval: numeric(data.interval) };
        detector.motion(normalized);
        motion.publish(normalized);
        setStatus('motion', 'active');
      });
    }
    if (capabilities.orientation && allowed('orientation')) {
      setStatus('orientation', 'waiting');
      listen(env.window, 'deviceorientation', event => {
        const data = event as unknown as Partial<OrientationData>;
        const normalized: OrientationData = { timestamp: Date.now(), alpha: numeric(data.alpha), beta: numeric(data.beta), gamma: numeric(data.gamma), absolute: data.absolute === true };
        detector.orientation(normalized); orientation.publish(normalized);
        setStatus('orientation', 'active');
      });
    }
    if (capabilities.pointer && env.window.PointerEvent) for (const phase of ['down', 'move', 'up', 'cancel'] as const) {
      listen(env.window, `pointer${phase}`, event => {
        const data = event as PointerEvent;
        publishPointer({ pointerId: data.pointerId, pointerType: data.pointerType, clientX: numeric(data.clientX), clientY: numeric(data.clientY), pressure: numeric(data.pressure) }, phase);
      });
      setStatus('pointer', 'waiting');
    } else if (capabilities.pointer) for (const [nativeEvent, phase] of [['touchstart', 'down'], ['touchmove', 'move'], ['touchend', 'up'], ['touchcancel', 'cancel']] as const) {
      listen(env.window, nativeEvent, event => {
        const changed = (event as TouchEvent).changedTouches;
        if (!changed) return;
        for (let index = 0; index < changed.length; index++) {
          const touch = changed.item(index);
          if (!touch) continue;
          publishPointer({ pointerId: touch.identifier, pointerType: 'touch', clientX: numeric(touch.clientX), clientY: numeric(touch.clientY), pressure: numeric(touch.force) }, phase);
        }
      });
      setStatus('pointer', 'waiting');
    }
    startLocation();
  }
  function ensureLifecycle() {
    if (!env || lifecycleAttached) return;
    lifecycleAttached = true;
    const change = () => {
      if (!wanted) return;
      if (env.document.visibilityState === 'hidden' || pageHidden) detach('paused');
      else if (!manuallyPaused) attach();
    };
    const hide = () => { pageHidden = true; change(); };
    const show = () => { pageHidden = false; change(); };
    for (const [target, name, fn] of [[env.document, 'visibilitychange', change], [env.window, 'pagehide', hide], [env.window, 'pageshow', show]] as const) {
      target.addEventListener(name, fn);
      lifecycleCleanups.push(() => target.removeEventListener(name, fn));
    }
  }
  function detach(state: 'paused' | 'stopped') {
    running = false; generation++; detector.reset(); releaseAllPointers();
    for (const cleanup of cleanups.splice(0)) cleanup();
    if (watchId !== undefined) env?.navigator.geolocation?.clearWatch(watchId);
    watchId = undefined;
    for (const c of channels) c.cancelPending();
    for (const name of names) if (['active', 'waiting', 'paused'].includes(status.api.getSnapshot()[name].state)) setStatus(name, state);
  }
  function stop() {
    wanted = false; manuallyPaused = false; permissionGeneration++;
    detach('stopped');
    for (const cleanup of lifecycleCleanups.splice(0)) cleanup();
    lifecycleAttached = false;
  }
  return {
    motion: motion.api, orientation: orientation.api, location: location.api, pointer: pointer.api, device: device.api, status: status.api, permissions: permissions.api, requestPermission,
    on(name: DetectorName, handler: (event: DetectorEvent) => void) {
      if (destroyed) return () => {};
      let handlers = eventHandlers.get(name); if (!handlers) { handlers = new Set(); eventHandlers.set(name, handlers); }
      handlers.add(handler); return () => { handlers.delete(handler); };
    },
    capabilities: () => ({ ...capabilities }), start,
    pause() { if (!destroyed && wanted) { manuallyPaused = true; detach('paused'); } },
    resume() { if (!destroyed && wanted) { manuallyPaused = false; attach(); } },
    stop,
    destroy() { if (destroyed) return; stop(); destroyed = true; eventHandlers.clear(); for (const c of channels) c.dispose(); },
  };
}
export type Sensors = ReturnType<typeof createSensors>;
function browserEnvironment(): SensorEnvironment | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return { window: window as unknown as SensorEnvironment['window'], document, navigator };
}
function numeric(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function vector(value?: { x?: unknown; y?: unknown; z?: unknown } | null) { return { x: numeric(value?.x), y: numeric(value?.y), z: numeric(value?.z) }; }
