<script lang="ts">
  import { onMount } from 'svelte';
  import { createSensors } from '@mobile-sensor/core';
  import type { DeviceState, DetectorName, SensorName } from '@mobile-sensor/core';
  import { createSensorStores } from '@mobile-sensor/svelte';
  import SensorGalleryFlow from './SensorGalleryFlow.svelte';

  let simulated = $state(false);
  let screen = $state<'catalog' | 'test'>('catalog');
  let selectedSensor = $state<SensorName>('motion');
  let hapticsEnabled = $state(false);
  let hapticsSupported = $state(false);
  const initialSensors = createSensors();
  let sensors = $state(initialSensors);
  const initialStores = createSensorStores(initialSensors, { fps: 8 });
  let motionStore = $state.raw(initialStores.motion);
  let orientationStore = $state.raw(initialStores.orientation);
  let locationStore = $state.raw(initialStores.location);
  let pointerStore = $state.raw(initialStores.pointer);
  let viewportStore = $state.raw(initialStores.viewport);
  let visibilityStore = $state.raw(initialStores.visibility);
  let deviceStore = $state.raw(initialStores.device);
  let statusStore = $state.raw(initialStores.status);
  let detectorState = $state<DeviceState>(initialSensors.device.getSnapshot());
  let deviceWatch: (() => void) | undefined;
  let running = $state(false);
  let paused = $state(false);
  let locationEnabled = $state(false);
  let events = $state<Array<{ id: number; time: string; name: string; source: string; intensity: number; timestamp: number }>>([]);
  let simTimer: ReturnType<typeof setInterval> | undefined;
  let simSample = 0;
  let simEnvironment: ReturnType<typeof makeSimulation> | undefined;
  let unsubscribers: Array<() => void> = [];
  const eventLabels: Record<DetectorName, string> = { shake: 'Shake', movement: 'Movement', stationary: 'Stationary', tilt: 'Tilt', rotation: 'Rotation' };

  function bindEvents() {
    unsubscribers.forEach(off => off());
    unsubscribers = (Object.keys(eventLabels) as DetectorName[]).map(name => sensors.on(name, event => {
      events = [{ id: Date.now() + Math.random(), time: new Date(event.timestamp).toLocaleTimeString('en-US'), name: eventLabels[name], source: event.source, intensity: event.intensity, timestamp: event.timestamp }, ...events].slice(0, 200);
      if (name === 'shake' || name === 'movement') vibrate([35, 30, 45]);
    }));
  }
  function modeEnvironment() {
    if (simulated) { simEnvironment = makeSimulation(); return simEnvironment.environment; }
    simEnvironment = undefined;
    return undefined;
  }
  function bindStores() {
    deviceWatch?.();
    const next = createSensorStores(sensors, { fps: 8 });
    deviceWatch = sensors.device.subscribe(value => detectorState = value, { throttle: 100 });
    motionStore = next.motion;
    orientationStore = next.orientation;
    locationStore = next.location;
    pointerStore = next.pointer;
    viewportStore = next.viewport;
    visibilityStore = next.visibility;
    deviceStore = next.device;
    statusStore = next.status;
  }
  function replaceSensors(useSimulation: boolean) {
    clearInterval(simTimer);
    simTimer = undefined;
    sensors.destroy();
    simulated = useSimulation;
    running = false;
    paused = false;
    locationEnabled = false;
    screen = 'catalog';
    selectedSensor = 'motion';
    simSample = 0;
    events = [];
    sensors = createSensors({ environment: modeEnvironment() });
    bindStores();
    bindEvents();
  }
  function makeSimulation() {
    const win = Object.assign(new EventTarget(), {
      isSecureContext: true,
      DeviceMotionEvent: {},
      DeviceOrientationEvent: {},
      PointerEvent: {},
      innerWidth: 390,
      innerHeight: 844,
      visualViewport: Object.assign(new EventTarget(), { width: 390, height: 844, scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0 }),
    });
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    let nextWatch = 0;
    const geolocation = {
      watchPosition(success: PositionCallback) {
        const watchId = ++nextWatch;
        queueMicrotask(() => success({
          timestamp: Date.now(),
          coords: { latitude: 25.033, longitude: 121.5654, accuracy: 12, altitude: null, altitudeAccuracy: null, speed: null, heading: null, toJSON: () => ({}) },
        } as GeolocationPosition));
        return watchId;
      },
      clearWatch() {},
    };
    const environment = { window: win, document: doc, navigator: { geolocation } } as unknown as NonNullable<Parameters<typeof createSensors>[0]>['environment'];
    return { environment, win };
  }
  function fire(type: string, data: object) { simEnvironment?.win.dispatchEvent(Object.assign(new Event(type), data)); }
  function simulate() {
    simSample++;
    const shake = simSample % 12 === 5 || simSample % 12 === 6;
    const wave = Math.sin(simSample / 3);
    fire('devicemotion', { acceleration: { x: shake ? (simSample % 2 ? 18 : -18) : wave * 0.35, y: Math.cos(simSample / 4) * 0.2, z: 0.1 }, accelerationIncludingGravity: { x: wave * 2, y: 3, z: 9.5 }, rotationRate: { alpha: simSample % 9 === 2 ? 45 : 2, beta: 3, gamma: 1 }, interval: 16 });
    fire('deviceorientation', { alpha: (simSample * 3) % 360, beta: 8 + Math.sin(simSample / 5) * 4, gamma: simSample % 15 > 9 ? 32 : 4, absolute: false });
    if (simSample % 3 === 0) fire('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 120 + simSample % 90, clientY: 230, pressure: 0.6 });
    fire('resize', {});
  }
  async function testSensor(name: SensorName) {
    try {
      vibrate(25);
      if (name === 'motion' || name === 'orientation') {
        // Invoke native permission methods directly from this user-initiated button action.
        const pendingPermission = sensors.requestPermission({ motion: true, orientation: true });
        await pendingPermission;
      }
      if (name === 'location') locationEnabled = true;
      await sensors.start({ location: name === 'location' || locationEnabled });
      if (paused) sensors.resume();
      running = true;
      paused = false;
      if (simulated && !simTimer) simTimer = setInterval(simulate, 120);
    } catch (error) { console.error(error); }
  }
  function pause() { sensors.pause(); clearInterval(simTimer); simTimer = undefined; running = false; paused = true; }
  function resume() { sensors.resume(); paused = false; if (simulated && !simTimer) simTimer = setInterval(simulate, 120); running = true; }
  function stop() { sensors.stop(); clearInterval(simTimer); simTimer = undefined; running = false; paused = false; }
  function clearEvents() { events = []; }
  function vibrate(pattern: number | number[]) {
    if (hapticsEnabled && hapticsSupported) navigator.vibrate(pattern);
  }
  function toggleHaptics(enabled: boolean) {
    hapticsEnabled = enabled;
    if (enabled && hapticsSupported) navigator.vibrate(25);
  }
  function selectSensor(name: SensorName) { selectedSensor = name; screen = 'test'; }
  function returnToCatalog() { screen = 'catalog'; }

  onMount(() => {
    hapticsSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    bindEvents();
    return () => { clearInterval(simTimer); unsubscribers.forEach(off => off()); deviceWatch?.(); sensors.destroy(); };
  });
</script>

<svelte:head><title>Mobile Sensors · Sensor Test</title><meta name="description" content="Choose a mobile sensor, follow the test steps, and see when data is received." /></svelte:head>
<div class="phone-stage"><main class="phone-screen app-screen" data-testid="device-frame">
  <header class="app-header">
    <a class="app-brand" href="#top" aria-label="Mobile Sensors home"><span>◉</span> mobile-sensors</a>
    <div class="mode-control" aria-label="Sensor input mode"><button class:active={!simulated} onclick={() => replaceSensors(false)}>Live</button><button class:active={simulated} onclick={() => replaceSensors(true)}>Demo</button></div>
  </header>
  <div class="app-status"><span class="run-indicator" class:live={running && !paused}></span><strong>{paused ? 'PAUSED' : running ? (simulated ? 'DEMO RUNNING' : 'SENSORS RUNNING') : simulated ? 'DEMO READY' : 'READY TO TEST'}</strong>
    <div class="app-actions">{#if paused}<button onclick={resume}>Resume</button>{:else if running}<button onclick={pause}>Pause</button>{/if}{#if running || paused}<button onclick={stop}>Stop</button>{/if}</div>
  </div>
  <SensorGalleryFlow {screen} {selectedSensor} values={{ motion: $motionStore, orientation: $orientationStore, location: $locationStore, pointer: $pointerStore, viewport: $viewportStore, visibility: $visibilityStore }} statuses={$statusStore} {detectorState} {events} {simulated} {hapticsEnabled} {hapticsSupported} onSelect={selectSensor} onBack={returnToCatalog} onTest={testSensor} onHapticChange={toggleHaptics} onClearEvents={clearEvents} />
  <footer class="app-footer"><span>LOCAL SENSOR PLAYGROUND</span><span>Device data stays on this device</span></footer>
</main></div>

<style>
  .app-screen{display:flex;flex-direction:column;overflow:hidden;padding:env(safe-area-inset-top) 17px env(safe-area-inset-bottom)}
  .app-header{display:flex;flex:none;align-items:center;justify-content:space-between;height:52px;border-bottom:1px solid #ddded6}.app-brand{color:#394039;text-decoration:none;font-size:17px;font-weight:750;letter-spacing:-.055em}.app-brand span{margin-right:5px;color:#839387;font-size:20px}
  .mode-control{display:flex;gap:2px;padding:3px;border-radius:9px;background:#e7e6dd}.mode-control button{min-height:32px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:#85877e;font-size:12px;font-weight:700}.mode-control button.active{background:#fbfaf5;color:#3b433c;box-shadow:0 1px 3px #383c351b}
  .app-status{display:flex;flex:none;align-items:center;gap:8px;height:40px;border-bottom:1px solid #e3e2d9;color:#81867e}.run-indicator{width:9px;height:9px;border-radius:50%;background:#b8b9ad}.run-indicator.live{background:#43a769;box-shadow:0 0 0 4px #43a76920}.app-status strong{flex:1;font:10px ui-monospace,monospace;letter-spacing:.08em;font-weight:600}.app-actions{display:flex;gap:6px}.app-actions button{min-height:29px;padding:0 9px;border:1px solid #d9d9d0;border-radius:6px;background:#fbfaf5;color:#616a61;font-size:11px}
  .app-footer{display:flex;flex:none;align-items:center;justify-content:space-between;gap:6px;min-height:31px;border-top:1px solid #ddded6;color:#898d83;font:8px ui-monospace,monospace;letter-spacing:.04em}
</style>
