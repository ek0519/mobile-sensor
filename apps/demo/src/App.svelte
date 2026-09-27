<script lang="ts">
  import { onMount } from 'svelte';
  import { createSensors } from '@solitudo-studio/core';
  import type { Sensors, SensorName, DeviceState } from '@solitudo-studio/core';
  import { createSensorStores } from '@solitudo-studio/svelte';
  let simulated = $state(false);
  const initialSensors = createSensors();
  let sensors = $state<Sensors>(initialSensors);
  const initialStores = createSensorStores(initialSensors, { fps: 8 });
  let motionStore = $state.raw(initialStores.motion); let orientationStore = $state.raw(initialStores.orientation); let locationStore = $state.raw(initialStores.location);
  let pointerStore = $state.raw(initialStores.pointer); let viewportStore = $state.raw(initialStores.viewport); let visibilityStore = $state.raw(initialStores.visibility);
  let deviceStore = $state.raw(initialStores.device); let detectorState = $state<DeviceState>(initialSensors.device.getSnapshot()); let deviceWatch: (() => void) | undefined; let statusStore = $state.raw(initialStores.status);
  let running = $state(false);
  let paused = $state(false);
  let locationEnabled = $state(false);
  let events = $state<Array<{ id: number; time: string; name: string; source: string; intensity: number; timestamp: number }>>([]);
  let shakeActive = $state(false); let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  let simTimer: ReturnType<typeof setInterval> | undefined;
  let simSample = 0;
  let simEnvironment: ReturnType<typeof makeSimulation> | undefined;
  let activePage = $state(0);
  let pageTrack: HTMLDivElement | undefined;
  const labels: Record<SensorName, { title: string; api: string }> = {
    motion: { title: 'Motion', api: 'DeviceMotionEvent' }, orientation: { title: 'Orientation', api: 'DeviceOrientationEvent' },
    location: { title: 'Location', api: 'Geolocation API' }, pointer: { title: 'Pointer', api: 'Pointer Events' },
    viewport: { title: 'Viewport', api: 'VisualViewport' }, visibility: { title: 'Visibility', api: 'Page Visibility' },
  };
  const eventLabels = { shake: 'Shake', movement: 'Movement', stationary: 'Stationary', tilt: 'Tilt', rotation: 'Rotation' } as const;
  let unsubscribers: Array<() => void> = [];
  function bindEvents() {
    unsubscribers.forEach(off => off());
    unsubscribers = (['shake', 'movement', 'stationary', 'tilt', 'rotation'] as const).map(name => sensors.on(name, event => {
      if (name === 'shake') { shakeActive = true; clearTimeout(shakeTimer); shakeTimer = setTimeout(() => shakeActive = false, 1800); }
      events = [{ id: Date.now() + Math.random(), time: new Date(event.timestamp).toLocaleTimeString('en-US'), name: eventLabels[name], source: event.source, intensity: event.intensity, timestamp: event.timestamp }, ...events].slice(0, 200);
    }));
  }
  function modeEnvironment() { if (simulated) { simEnvironment = makeSimulation(); return simEnvironment.environment; } simEnvironment = undefined; return undefined; }
  function bindStores() { deviceWatch?.(); const next = createSensorStores(sensors, { fps: 8 }); deviceWatch = sensors.device.subscribe(value => detectorState = value, { throttle: 100 }); motionStore = next.motion; orientationStore = next.orientation; locationStore = next.location; pointerStore = next.pointer; viewportStore = next.viewport; visibilityStore = next.visibility; deviceStore = next.device; statusStore = next.status; }
  function replaceSensors(useSimulation: boolean) {
    clearInterval(simTimer); clearTimeout(shakeTimer); shakeTimer = undefined; shakeActive = false; simTimer = undefined; sensors.destroy();
    simulated = useSimulation; running = false; paused = false; locationEnabled = false; events = [];
    sensors = createSensors({ environment: modeEnvironment() }); bindStores(); bindEvents();
  }
  function makeSimulation() {
    const win = Object.assign(new EventTarget(), { isSecureContext: true, DeviceMotionEvent: {}, DeviceOrientationEvent: {}, PointerEvent: {}, innerWidth: 390, innerHeight: 844,
      visualViewport: Object.assign(new EventTarget(), { width: 390, height: 844, scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0 }) });
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const environment = { window: win, document: doc, navigator: {} } as unknown as NonNullable<Parameters<typeof createSensors>[0]>['environment'];
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
  async function enableMotion() {
    try { const pending = sensors.requestPermission({ motion: true, orientation: true }); await pending; await sensors.start({ location: locationEnabled }); running = true; paused = false; if (simulated && !simTimer) { simTimer = setInterval(simulate, 120); } }
    catch (error) { console.error(error); }
  }
  async function enableLocation() { const wasPaused = paused; locationEnabled = true; try { await sensors.start({ location: true }); if (!wasPaused) { running = true; paused = false; if (simulated && !simTimer) simTimer = setInterval(simulate, 120); } } catch (error) { console.error(error); } }
  function pause() { sensors.pause(); clearInterval(simTimer); simTimer = undefined; running = false; paused = true; }
  function resume() { sensors.resume(); paused = false; if (simulated && !simTimer) simTimer = setInterval(simulate, 120); running = true; paused = false; }
  function stop() { sensors.stop(); clearInterval(simTimer); simTimer = undefined; running = false; paused = false; }
  function detectorActive(name: keyof typeof eventLabels) {
    if (name === 'shake') return shakeActive;
    if (name === 'movement') return detectorState.moving === true;
    if (name === 'stationary') return detectorState.stationary === true;
    if (name === 'tilt') return detectorState.tilting === true;
    return detectorState.rotating === true;
  }
  function clearEvents() { events = []; shakeActive = false; clearTimeout(shakeTimer); shakeTimer = undefined; }
  function showPage(index: number) { activePage = index; pageTrack?.scrollTo({ left: index * pageTrack.clientWidth, behavior: 'smooth' }); }
  function handlePageScroll() { if (pageTrack?.clientWidth) activePage = Math.min(1, Math.max(0, Math.round(pageTrack.scrollLeft / pageTrack.clientWidth))); }
  function capability(name: SensorName) { return sensors.capabilities()[name]; }
  function stateLabel(name: SensorName) { const state = sensors.status.getSnapshot()[name].state; return ({ 'unsupported': 'Unsupported', 'permission-required': 'Permission needed', 'denied': 'Denied', idle: 'Inactive', waiting: 'Waiting', active: 'Live', paused: 'Paused', stopped: 'Stopped', error: 'Error' } as Record<string, string>)[state] ?? state; }
  function display(name: SensorName, value: unknown) {
    if (value == null) return capability(name) ? 'Waiting for data' : 'Not supported';
    return JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toFixed(2)) : item);
  }
  onMount(() => { bindEvents(); return () => { clearInterval(simTimer); clearTimeout(shakeTimer); unsubscribers.forEach(off => off()); sensors.destroy(); }; });
</script>
<svelte:head><title>Mobile Sensors · Sensor Dashboard</title><meta name="description" content="Live mobile sensor data and detected events." /></svelte:head>
<div class="phone-stage"><main class="phone-screen" data-testid="device-frame">
  <header class="topbar"><a class="brand" href="#top" aria-label="Mobile Sensors home"><span class="brand-icon" aria-hidden="true">◉</span> mobile<span>-sensors</span></a><span class="version">SENSOR PLAYGROUND</span></header>
  <section class="hero" id="top"><div class="eyebrow"><span class="pulse"></span> {simulated ? 'SIMULATION' : 'LIVE SENSORS · LOCAL'}</div><h1>Mobile sensors,<br /><span>made visible.</span></h1>
    <div class="toolbar"><div class="mode-switch" aria-label="Sensor mode"><button class:chosen={!simulated} onclick={() => replaceSensors(false)}>Live</button><button class:chosen={simulated} onclick={() => replaceSensors(true)}>Demo</button></div>
      {#if paused}<button class="secondary" onclick={resume}>Resume</button><button class="secondary" onclick={stop}>Stop</button>{:else if !running}<button class="primary" onclick={enableMotion}>Enable motion <span>↗</span></button>{:else}<button class="secondary" onclick={pause}>Pause</button><button class="secondary" onclick={stop}>Stop</button>{/if}
      <button class="secondary" onclick={enableLocation}>Enable location⌖</button>
    </div>
    {#if simulated}<p class="mode-note">Demo data uses the same detection pipeline.</p>{:else}<aside class="permission-guidance" role="note" data-testid="permission-guidance"><span class="guidance-icon" aria-hidden="true">⌁</span><div><strong>Use on your phone · Allow sensor access</strong><p>Enable motion to grant access. Location requires separate permission and HTTPS.</p></div></aside>{/if}
  </section>
  <nav class="page-nav" aria-label="Sensor pages"><button aria-current={activePage === 0 ? 'page' : undefined} onclick={() => showPage(0)}>Sensors <span>01</span></button><button aria-current={activePage === 1 ? 'page' : undefined} onclick={() => showPage(1)}>Events <span>02</span></button></nav>
  <div class="horizontal-pages" data-testid="horizontal-pages" bind:this={pageTrack} onscroll={handlePageScroll}>
  <div class="page" data-page="0"><section class="section" aria-labelledby="signals-title"><div class="section-heading"><div><div class="eyebrow">01 / SENSOR FEED</div><h2 id="signals-title">Sensor Signals</h2></div><span class="section-aside">{$statusStore.motion.state === 'active' || $statusStore.orientation.state === 'active' ? '● LIVE' : '○ IDLE'}</span></div>
    <div class="sensor-grid">{#each Object.entries(labels) as [key, meta] (key)}{@const name = key as SensorName}<article class="sensor-card" class:active={$statusStore[name].state === 'active'}><div class="card-top"><span class="sensor-dot" class:lit={$statusStore[name].state === 'active'}></span><span class="sensor-state">{stateLabel(name)}</span><span class="card-index">SENSOR / 0{Object.keys(labels).indexOf(key) + 1}</span></div><h3>{meta.title}</h3><code class="api-label">{meta.api}</code><pre data-sensor={name}>{display(name, name === 'motion' ? $motionStore : name === 'orientation' ? $orientationStore : name === 'location' ? $locationStore : name === 'pointer' ? $pointerStore : name === 'viewport' ? $viewportStore : $visibilityStore)}</pre>{#if $statusStore[name].error}<p class="error">{$statusStore[name].error}</p>{/if}</article>{/each}</div>
  </section>
  </div>
  <div class="page" data-page="1">
  <section class="section detectors" aria-labelledby="detectors-title"><div class="section-heading"><div><div class="eyebrow">02 / DETECTORS</div><h2 id="detectors-title">Detected Events</h2></div><span class="section-aside">Heuristic · Adjustable</span></div><div class="detector-grid">{#each Object.entries(eventLabels) as [key, title], index}<article class="detector-card"><span class="detector-number">0{index + 1}</span><span class="detector-title">{title}</span>{#if detectorActive(key as keyof typeof eventLabels)}<span class="triggered">Triggered</span>{:else}<span class="waiting">Waiting</span>{/if}</article>{/each}</div></section>
  <section class="section log-section" aria-labelledby="log-title"><div class="section-heading"><div><div class="eyebrow">03 / EVENT STREAM</div><h2 id="log-title">Event Log <span class="count">{events.length}</span></h2><span class="section-aside">Latest 2</span></div><button class="text-button" onclick={clearEvents}>Clear ↗</button></div>{#if events.length}<ol class="event-list">{#each events.slice(0, 2) as event (event.id)}<li><time>{event.time}</time><span class="event-pill">{event.name}</span><span>{event.source === 'motion' ? 'Motion' : 'Orientation'}</span><span class="intensity">Intensity {event.intensity.toFixed(1)}</span></li>{/each}</ol>{:else}<div class="empty-log"><span>◌</span><p>No events yet.</p><small>{simulated ? 'Demo data is generating motion.' : 'Enable motion, then move or rotate your phone.'}</small></div>{/if}</section>
  </div>
  </div>
  <footer><span>MOBILE-SENSORS / WEB PLAYGROUND</span><span>For interaction demos · Not for medical or safety use</span></footer>
</main></div>
