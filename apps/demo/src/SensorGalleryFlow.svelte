<script lang="ts">
  import type { DetectorName, DeviceState, LocationData, MotionData, MotionDirection, OrientationData, PointerData, SensorName, Status } from '@mobile-sensor/core';
  import SensorVisual from './SensorVisual.svelte';

  type Values = { motion: MotionData | null; orientation: OrientationData | null; location: LocationData | null; pointer: PointerData | null };
  type SensorEvent = { id: number; time: string; name: string; source: string; intensity: number | null; timestamp: number };
  interface Props {
    screen: 'catalog' | 'test';
    selectedSensor: SensorName;
    values: Values;
    statuses: Status;
    detectorState: DeviceState;
    events: SensorEvent[];
    simulated: boolean;
    hapticsEnabled: boolean;
    hapticsSupported: boolean;
    onSelect: (sensor: SensorName) => void;
    onBack: () => void;
    onTest: (sensor: SensorName) => void;
    onHapticChange: (enabled: boolean) => void;
    onClearEvents: () => void;
  }
  let { screen, selectedSensor, values, statuses, detectorState, events, simulated, hapticsEnabled, hapticsSupported, onSelect, onBack, onTest, onHapticChange, onClearEvents }: Props = $props();

  const sensorOrder: SensorName[] = ['motion', 'orientation', 'location', 'pointer'];
  const sensorInfo: Record<SensorName, { title: string; group: string; api: string; action: string; guide: string; icon: string; unit: string }> = {
    motion: { title: 'Motion', group: 'MOVEMENT', api: 'DeviceMotionEvent', action: 'Trace a circle with your phone', guide: 'Screen-facing view: clockwise = right; counterclockwise = left.', icon: '↗', unit: 'm/s²' },
    orientation: { title: 'Orientation', group: 'DIRECTION', api: 'DeviceOrientationEvent', action: 'Tilt forward, backward, left, or right', guide: '螢幕朝上為正面，朝下為反面；保持姿勢片刻即可辨識。', icon: '◉', unit: '°' },
    location: { title: 'Location', group: 'POSITION', api: 'Geolocation API', action: 'Find your current position', guide: 'Allow location access. Location works over HTTPS.', icon: '⌖', unit: 'lat / lng' },
    pointer: { title: 'Touch', group: 'PRESS ZONES', api: 'Pointer Events', action: 'Press the left or right side', guide: 'Hold either side; both can be pressed together. The center 100 px is inactive.', icon: '◎', unit: 'px' },
  };
  const detectorGroups: Partial<Record<SensorName, DetectorName[]>> = { motion: ['direction', 'shake', 'movement', 'stationary', 'rotation'], orientation: ['screen-face', 'tilt', 'tilt-direction', 'rotation'], pointer: ['left-press', 'right-press'] };
  const detectorLabel: Record<DetectorName, string> = { 'screen-face': '正面／反面', direction: 'Direction', shake: 'Shake', movement: 'Move', stationary: 'Still', tilt: 'Tilt', 'tilt-direction': 'Tilt direction', rotation: 'Turn rate', 'left-press': 'Left press', 'right-press': 'Right press' };
  let detectors = $derived(detectorGroups[selectedSensor] ?? []);
  let detectorHeading = $derived(selectedSensor === 'pointer' ? 'TOUCH DETECTORS' : selectedSensor === 'orientation' ? 'ORIENTATION DETECTORS' : 'MOTION DETECTORS');
  let info = $derived(sensorInfo[selectedSensor]);
  let sensorStatus = $derived(statuses[selectedSensor]);
  let passed = $derived(sensorStatus.state === 'active' && hasReading(selectedSensor));
  let headline = $derived(readingHeadline(selectedSensor));
  let statusLabel = $derived(passed ? 'CHECK PASSED' : statusText(sensorStatus.state));
  let help = $derived(sensorStatus.error ? sensorStatus.error : sensorStatus.state === 'denied' && selectedSensor === 'motion' ? 'Motion access is blocked. Enable it in your phone browser settings.' : (sensorStatus.state === 'waiting' || sensorStatus.state === 'active') && !hasReading(selectedSensor) ? selectedSensor === 'motion' ? 'No motion data yet. Use HTTPS, allow access if asked, then move the phone.' : 'No sensor data yet. Check browser permissions and follow the instruction.' : info.guide);
  let resultMessage = $derived(passed ? 'Your sensor is responding.' : sensorStatus.error ? sensorStatus.error : sensorStatus.state === 'denied' ? 'Allow sensor access in your browser settings, then try again.' : (sensorStatus.state === 'waiting' || sensorStatus.state === 'active') && !hasReading(selectedSensor) ? selectedSensor === 'motion' ? 'No motion data yet. Allow access, then move your phone.' : 'Waiting for data. Follow the instruction.' : 'Start the test and follow the instruction.');

  function hasReading(name: SensorName): boolean {
    switch (name) {
      case 'motion': { const value = values.motion; return value !== null && (Object.values(value.acceleration).some(item => item !== null) || Object.values(value.accelerationIncludingGravity).some(item => item !== null) || Object.values(value.rotationRate).some(item => item !== null)); }
      case 'orientation': { const value = values.orientation; return value !== null && (value.alpha !== null || value.beta !== null || value.gamma !== null); }
      case 'location': return values.location !== null;
      case 'pointer': return detectorState.leftPressed || detectorState.rightPressed || events.some(event => event.source === 'pointer');
    }
  }
  function readingHeadline(name: SensorName): string {
    if (!hasReading(name)) return sensorStatus.state === 'unsupported' ? 'Not available' : 'Waiting for signal';
    switch (name) {
      case 'motion': { const value = values.motion!; return `X ${fixed(value.acceleration.x ?? value.accelerationIncludingGravity.x)} · Y ${fixed(value.acceleration.y ?? value.accelerationIncludingGravity.y)} · Z ${fixed(value.acceleration.z ?? value.accelerationIncludingGravity.z)}`; }
      case 'orientation': { const value = values.orientation!; return `α ${fixed(value.alpha)} · β ${fixed(value.beta)} · γ ${fixed(value.gamma)}`; }
      case 'location': { const value = values.location!; return `${value.latitude.toFixed(4)}, ${value.longitude.toFixed(4)}`; }
      case 'pointer': { const value = values.pointer!; return `${value.pointerType} · ${value.x ?? '—'}, ${value.y ?? '—'}`; }
    }
  }
  function fixed(value: number | null) { return value === null ? '—' : value.toFixed(1); }
  function statusText(state: string) {
    if (state === 'permission-required') return 'ALLOW ACCESS';
    if (state === 'denied') return 'ACCESS DENIED';
    if (state === 'unsupported') return 'NOT AVAILABLE';
    if (state === 'waiting' || state === 'active') return 'WAITING FOR DATA';
    if (state === 'error') return 'CHECK SETTINGS';
    if (state === 'paused') return 'PAUSED';
    if (state === 'stopped') return 'STOPPED';
    return 'READY TO TEST';
  }
  function detectorActive(name: DetectorName): boolean | null {
    if (name === 'shake') return detectorState.shaking;
    if (name === 'movement') return detectorState.moving;
    if (name === 'stationary') return detectorState.stationary;
    if (name === 'tilt') return detectorState.tilting;
    if (name === 'screen-face') return detectorState.screenFace === null ? null : detectorState.screenFace !== 'edge';
    if (name === 'tilt-direction') return detectorState.tiltDirection !== null;
    if (name === 'direction') return detectorState.direction !== null;
    if (name === 'rotation') return detectorState.rotating;
    if (name === 'left-press') return detectorState.leftPressed;
    if (name === 'right-press') return detectorState.rightPressed;
    return null;
  }
  function rawValue(name: SensorName, values: Values) {
    const value = name === 'motion' ? values.motion : name === 'orientation' ? values.orientation : name === 'location' ? values.location : values.pointer;
    return value === null ? 'No sensor data received yet' : JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toFixed(2)) : item);
  }
</script>

<section class="sensor-flow" class:catalog-view={screen === 'catalog'} class:test-view={screen === 'test'}>
  {#if screen === 'catalog'}
    <header class="flow-heading">
      <div><p class="eyebrow">STEP 01 <span>/ 02</span> · SELECT</p><h1>Choose a sensor</h1><p class="subhead">Pick a feature to start its guided test.</p></div>
      <span class="heading-icon" aria-hidden="true">⌁</span>
    </header>

    <nav class="catalog catalog-b" aria-label="Sensor features">
      {#each sensorOrder as sensor, index}
        <button class="sensor-card" onclick={() => onSelect(sensor)} aria-label={`${sensorInfo[sensor].title} · ${sensorInfo[sensor].group}`}>
          <span class="card-top"><small>0{index + 1} / 04</small><i class:ready={statuses[sensor].state === 'active'}></i></span>
          <span class="card-icon">{sensorInfo[sensor].icon}</span><strong>{sensorInfo[sensor].title}</strong><small>{sensorInfo[sensor].group}</small><span class="card-arrow">OPEN TEST ↗</span>
        </button>
      {/each}
    </nav>
    <div class="catalog-hint"><span class="hint-dot"></span><span>SELECT A FEATURE</span><span>4 SENSORS</span></div>
  {:else}
    <header class="test-heading">
      <button class="back-button" onclick={onBack} aria-label="All sensors"><span>←</span> All sensors</button>
      <div class="step-rail" aria-label="Step 2 of 2"><span class="done"><i>✓</i> SELECT</span><b></b><span class="current"><i>02</i> TEST</span></div>
    </header>
    <div class="test-title">
      <div><p class="eyebrow">STEP 02 · {info.group}</p><h1>Test {info.title}</h1><code>{info.api}</code></div>
      <span class="state-pill" class:passed>{passed ? 'PASS' : statusLabel}</span>
    </div>

    <div class="detail-layout detail-b">
      <SensorVisual sensor={selectedSensor} {values} direction={detectorState.direction} tiltDirection={detectorState.tiltDirection} screenFace={detectorState.screenFace} shaking={detectorState.shaking === true} leftPressed={detectorState.leftPressed} rightPressed={detectorState.rightPressed} {passed} />
      <div class="instruction-card"><span class="instruction-icon">{info.icon}</span><div><strong>{info.action}</strong><p>{help}</p></div></div>
    </div>

    <div class="result-strip" class:passed aria-live="polite"><span class="status-light" class:green={passed}><i></i></span><span class="result-copy"><strong>{statusLabel}</strong><small>{resultMessage}</small></span><span class="result-arrow">{passed ? '✓' : '···'}</span></div>
    <div class="test-controls">
      <button class="start-button" onclick={() => onTest(selectedSensor)} disabled={sensorStatus.state === 'unsupported'}>{passed ? 'Test again' : 'Start test'}<span>↗</span></button>
      <label class="haptic-toggle" class:unavailable={!hapticsSupported}><input type="checkbox" checked={hapticsEnabled} disabled={!hapticsSupported} onchange={event => onHapticChange(event.currentTarget.checked)} /><span class="haptic-icon">⌁</span><span><strong>Haptic feedback</strong><small>{hapticsSupported ? 'Vibrate on action' : 'Not supported here'}</small></span></label>
    </div>

    <section class="signal-details">
      <div class="detail-section-head"><strong>LIVE SIGNAL</strong><small>{passed ? 'DATA RECEIVED' : simulated ? 'DEMO READY' : 'WAITING'}</small></div>
      <div class="reading-line"><span class="reading-summary">{headline}</span><details><summary>RAW</summary><pre>{rawValue(selectedSensor, values)}</pre></details></div>
    </section>
    <section class="event-section" aria-label={`${detectorHeading} results`}>
      <div class="detail-section-head"><strong>{detectorHeading}</strong><small>EVENTS {events.length}</small></div>
      <div class="detector-chips">{#each detectors as detector}<span class:active={detectorActive(detector) === true} class:unknown={detectorActive(detector) === null}><i></i>{detectorLabel[detector]}</span>{/each}</div>
      <div class="event-row">{#if events.length}<span class="event-time">{events[0]!.time}</span><strong>{events[0]!.name}</strong><span>{events[0]!.source}</span><button onclick={onClearEvents}>CLEAR</button>{:else}<span class="event-empty">{simulated ? 'Demo motion will create a sample event.' : 'Move your phone to detect an event.'}</span><button disabled onclick={onClearEvents}>CLEAR</button>{/if}</div>
    </section>
  {/if}
</section>

<style>
  .sensor-flow{display:flex;flex:1;min-height:0;flex-direction:column;gap:8px;padding:10px 1px 8px;color:#333b34;overflow:hidden}
  .flow-heading{display:flex;flex:none;align-items:center;justify-content:space-between;min-height:67px}.eyebrow{margin:0 0 5px;color:#819181;font:10px ui-monospace,monospace;letter-spacing:.1em;font-weight:700}.eyebrow span{color:#afb1a5}.flow-heading h1,.test-title h1{margin:0;font-size:25px;line-height:1.08;letter-spacing:-.055em}.subhead{margin:5px 0 0;color:#80857c;font-size:13px}.heading-icon{display:grid;place-items:center;width:42px;height:42px;border:1px solid #d6ded3;border-radius:50%;background:#ebeee6;color:#718573;font-size:27px}
  .catalog{display:grid;flex:1;min-height:0;gap:7px;align-content:center;overflow:hidden}.catalog button{font:inherit;color:inherit;text-align:left;cursor:pointer}.sensor-card:active{transform:scale(.985);border-color:#9aa999;background:#f0f3ec}
  .catalog-b{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:8px}.sensor-card{position:relative;display:flex;min-height:0;flex-direction:column;align-items:flex-start;justify-content:flex-start;padding:8px;border:1px solid #dcddd4;border-radius:12px;background:#fbfaf5;overflow:hidden;transition:transform .15s,border-color .15s}.card-top{display:flex;width:100%;align-items:center;justify-content:space-between;color:#9a9d91;font:10px ui-monospace,monospace}.card-top i{width:8px;height:8px;border-radius:50%;background:#c2c4b8}.card-top i.ready{background:#58a56c;box-shadow:0 0 0 4px #58a56c20}.card-icon{display:grid;flex:1;min-height:22px;place-items:center;color:#819384;font-size:42px}.sensor-card strong{font-size:18px;line-height:1.1}.sensor-card>small{margin-top:3px;color:#8b8f85;font:10px ui-monospace,monospace;letter-spacing:.04em}.card-arrow{position:absolute;right:8px;bottom:8px;color:#9aa092;font:9px ui-monospace,monospace;letter-spacing:.05em}
  .catalog-hint{display:flex;flex:none;align-items:center;gap:7px;min-height:22px;color:#8d9187;font:9px ui-monospace,monospace;letter-spacing:.08em}.catalog-hint span:last-child{margin-left:auto}.hint-dot{width:7px;height:7px;border-radius:50%;background:#9bae99}
  .test-heading{display:flex;flex:none;align-items:center;justify-content:space-between;min-height:38px;border-bottom:1px solid #e1e2d9}.back-button{display:flex;align-items:center;gap:6px;min-height:30px;padding:0 5px;border:0;border-radius:7px;background:transparent;color:#607263;font-size:11px;font-weight:650}.back-button span{font-size:17px}.step-rail{display:flex;align-items:center;gap:5px;color:#a1a499;font:7px ui-monospace,monospace;letter-spacing:.07em}.step-rail span{display:flex;align-items:center;gap:3px}.step-rail i{display:grid;place-items:center;width:16px;height:16px;border:1px solid #d7dbd2;border-radius:50%;font-size:7px;font-style:normal}.step-rail .done{color:#68836c}.step-rail .done i{border-color:#bbd0bb;background:#e8efe6}.step-rail .current{color:#566c59}.step-rail .current i{border-color:#8d9e8e;background:#e5ebe1}.step-rail b{width:18px;height:1px;background:#d9ddd4}
  .test-title{display:flex;flex:none;align-items:center;justify-content:space-between;gap:5px;min-height:52px}.test-title .eyebrow{margin-bottom:3px;font-size:8px}.test-title h1{font-size:22px}.test-title code{display:block;margin-top:4px;color:#858a80;font:9px ui-monospace,monospace}.state-pill{flex:none;padding:5px 7px;border:1px solid #dcddd4;border-radius:20px;color:#858a80;font:7px ui-monospace,monospace;letter-spacing:.05em}.state-pill.passed{border-color:#a9d0ad;background:#eff7ed;color:#417e4c}
  .detail-layout{display:flex;flex:1;min-height:0;flex-direction:column;gap:7px}.detail-b :global(.visual){order:0}
  .instruction-card{display:flex;flex:none;align-items:center;gap:9px;min-height:54px;padding:7px 9px;border:1px solid #dce0d7;border-radius:10px;background:#f8f8f1}.instruction-icon{display:grid;flex:none;place-items:center;width:31px;height:31px;border-radius:9px;background:#e8ece4;color:#708673;font-size:19px}.instruction-card strong{display:block;color:#424b42;font-size:12px;line-height:1.15}.instruction-card p{margin:3px 0 0;color:#7e8378;font-size:9px;line-height:1.35}
  .result-strip{display:flex;flex:none;align-items:center;gap:9px;min-height:49px;padding:6px 9px;border:1px solid #ddded5;border-radius:10px;background:#f0efe9}.result-strip.passed{border-color:#acd1af;background:#edf6ed}.status-light{display:grid;flex:none;place-items:center;width:27px;height:27px;border:1px solid #d2d3c9;border-radius:50%;background:#e4e3da}.status-light i{width:9px;height:9px;border-radius:50%;background:#b2b4a8}.status-light.green{border-color:#a8d3ad;background:#def1df}.status-light.green i{background:#40a465;box-shadow:0 0 0 5px #40a46522,0 0 13px #40a46590;animation:glow 1.1s ease-in-out infinite alternate}.result-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.result-copy strong{color:#697366;font:8px ui-monospace,monospace;letter-spacing:.08em}.result-strip.passed .result-copy strong{color:#347e49}.result-copy small{overflow:hidden;color:#82867c;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.result-arrow{color:#8a9286;font-size:15px}.result-strip.passed .result-arrow{color:#419250}
  .test-controls{display:flex;flex:none;align-items:stretch;gap:7px;min-height:44px}.start-button{display:flex;flex:1;align-items:center;justify-content:space-between;min-width:0;padding:0 12px;border:0;border-radius:9px;background:#859587;color:white;font-size:13px;font-weight:700}.start-button:disabled{opacity:.45}.start-button span{font-size:17px}.haptic-toggle{display:flex;align-items:center;gap:6px;padding:0 7px;border:1px solid #d9ddd4;border-radius:9px;background:#fafaf5;cursor:pointer}.haptic-toggle input{position:absolute;width:1px;height:1px;opacity:0}.haptic-toggle:has(input:checked){border-color:#9fb59e;background:#eaf1e7}.haptic-icon{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#e7ebe3;color:#718774;font-size:15px}.haptic-toggle>span:last-child{display:flex;flex-direction:column;gap:2px}.haptic-toggle strong{color:#5f6b5e;font-size:9px}.haptic-toggle small{color:#91958b;font-size:7px}
  .signal-details,.event-section{flex:none;padding:6px 8px;border:1px solid #dedfd6;border-radius:9px;background:#faf9f4}.detail-section-head{display:flex;align-items:center;justify-content:space-between;color:#82887e;font:7px ui-monospace,monospace;letter-spacing:.08em}.detail-section-head small{color:#9a9d93;font-size:7px}.reading-line{display:flex;align-items:center;gap:7px;margin-top:4px}.reading-summary{flex:1;overflow:hidden;color:#566857;font:9px ui-monospace,monospace;text-overflow:ellipsis;white-space:nowrap}.reading-line details{position:relative}.reading-line summary{color:#8d9389;font:7px ui-monospace,monospace;cursor:pointer}.reading-line pre{position:absolute;z-index:5;right:0;bottom:14px;width:220px;max-height:100px;overflow:auto;margin:0;padding:7px;border:1px solid #d9ddd4;border-radius:7px;background:#fffef8;color:#6e756b;font:8px ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 4px 14px #0002}
  .detector-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.detector-chips span{display:flex;align-items:center;gap:4px;padding:3px 5px;border-radius:5px;background:#f0efe9;color:#80867b;font-size:8px}.detector-chips i{width:5px;height:5px;border-radius:50%;background:#b9bcb1}.detector-chips .active{background:#e4f1e4;color:#3f804c}.detector-chips .active i{background:#4aa467}.detector-chips .unknown{color:#9ea096}.event-row{display:flex;align-items:center;gap:6px;min-height:20px;margin-top:4px;padding-top:4px;border-top:1px solid #ecebe4;color:#778075;font-size:8px}.event-row strong{color:#4f704f;font-size:9px}.event-time{font:7px ui-monospace,monospace}.event-row button{min-height:18px;margin-left:auto;padding:0 3px;border:0;background:transparent;color:#92968c;font:7px ui-monospace,monospace}.event-empty{overflow:hidden;color:#868b81;text-overflow:ellipsis;white-space:nowrap}
  @keyframes glow{to{box-shadow:0 0 0 8px #40a46512,0 0 20px #40a465aa}}
  @media(max-height:740px){.sensor-flow{gap:5px;padding:6px 1px}.flow-heading{min-height:57px}.flow-heading h1{font-size:22px}.catalog-b{gap:5px}.sensor-card{padding:6px}.card-top{font-size:9px}.sensor-card strong{font-size:16px}.sensor-card>small{font-size:9px}.card-arrow{font-size:8px}.card-icon{font-size:34px}.detail-layout :global(.visual){min-height:105px}.test-title{min-height:45px}.test-title h1{font-size:20px}.instruction-card{min-height:44px;padding:5px 7px}.instruction-icon{width:26px;height:26px}.start-button{min-height:38px}.test-controls{min-height:38px}.signal-details,.event-section{padding:4px 6px}}
  @media(max-width:360px){.catalog{gap:4px}.sensor-card{padding:6px}.sensor-card strong{font-size:14px}.sensor-card>small{font-size:8px}.card-arrow{font-size:7px}.card-icon{font-size:32px}.test-title h1{font-size:19px}.haptic-toggle{gap:4px;padding:0 5px}.haptic-toggle strong{font-size:8px}}
</style>
