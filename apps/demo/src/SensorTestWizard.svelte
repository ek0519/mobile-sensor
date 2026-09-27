<script lang="ts">
  import type { DetectorName, DeviceState, LocationData, MotionData, OrientationData, PointerData, SensorName, Status, ViewportData } from '@solitudo-studio/core';

  type SensorValues = {
    motion: MotionData | null;
    orientation: OrientationData | null;
    location: LocationData | null;
    pointer: PointerData | null;
    viewport: ViewportData | null;
    visibility: 'visible' | 'hidden' | null;
  };
  type SensorEvent = { id: number; time: string; name: string; source: string; intensity: number; timestamp: number };
  interface Props {
    values: SensorValues;
    statuses: Status;
    detectorState: DeviceState;
    events: SensorEvent[];
    simulated: boolean;
    onTest: (sensor: SensorName) => void;
    onClearEvents: () => void;
  }
  let { values, statuses, detectorState, events, simulated, onTest, onClearEvents }: Props = $props();

  const sensorOrder: SensorName[] = ['motion', 'orientation', 'location', 'pointer', 'viewport', 'visibility'];
  const sensorInfo: Record<SensorName, { title: string; short: string; api: string; action: string; guide: string; unit: string }> = {
    motion: { title: 'Motion', short: 'Movement', api: 'DeviceMotionEvent', action: 'Shake your phone gently', guide: 'Allow motion access, then move your phone.', unit: 'm/s²' },
    orientation: { title: 'Orientation', short: 'Direction', api: 'DeviceOrientationEvent', action: 'Tilt your phone in any direction', guide: 'Allow orientation access, then tilt your phone.', unit: '°' },
    location: { title: 'Location', short: 'Position', api: 'Geolocation API', action: 'Request your current position', guide: 'Allow location access. Location requires HTTPS.', unit: 'lat / lng' },
    pointer: { title: 'Touch', short: 'Interaction', api: 'Pointer Events', action: 'Touch or drag anywhere on screen', guide: 'Start the feed, then tap or drag on this page.', unit: 'px' },
    viewport: { title: 'Viewport', short: 'Screen size', api: 'VisualViewport', action: 'Resize or zoom the page', guide: 'Start the feed to read the visible screen area.', unit: 'px' },
    visibility: { title: 'Visibility', short: 'Page state', api: 'Page Visibility', action: 'Switch to another tab and return', guide: 'Start the feed, then background this page.', unit: 'state' },
  };
  const detectorNames: DetectorName[] = ['shake', 'movement', 'stationary', 'tilt', 'rotation'];
  const detectorLabels: Record<DetectorName, string> = { shake: 'Shake', movement: 'Movement', stationary: 'Stationary', tilt: 'Tilt', rotation: 'Rotation' };
  const checklist = ['Start', 'Allow', 'Move', 'Confirm'];
  let step = $state(0);
  let selectedSensor = $derived(sensorOrder[step] ?? 'motion');
  let info = $derived(sensorInfo[selectedSensor]);
  let sensorStatus = $derived(statuses[selectedSensor]);
  let passed = $derived(sensorStatus.state === 'active' && hasReading(selectedSensor));
  let headline = $derived(headlineValue(selectedSensor));
  let raw = $derived(rawValue(selectedSensor));
  let stateText = $derived(passed ? 'CHECK PASSED' : statusText(sensorStatus.state));
  let instructions = $derived(sensorStatus.error ? sensorStatus.error : info.guide);

  function hasReading(name: SensorName): boolean {
    switch (name) {
      case 'motion': { const value = values.motion; return value !== null && (Object.values(value.acceleration).some(item => item !== null) || Object.values(value.accelerationIncludingGravity).some(item => item !== null) || Object.values(value.rotationRate).some(item => item !== null)); }
      case 'orientation': { const value = values.orientation; return value !== null && (value.alpha !== null || value.beta !== null || value.gamma !== null); }
      case 'location': return values.location !== null;
      case 'pointer': { const value = values.pointer; return value !== null && (value.x !== null || value.y !== null); }
      case 'viewport': return values.viewport !== null;
      case 'visibility': return values.visibility !== null;
    }
  }
  function headlineValue(name: SensorName): string {
    if (!hasReading(name)) return sensorStatus.state === 'unsupported' ? 'Not supported' : 'Waiting for data';
    switch (name) {
      case 'motion': { const value = values.motion!; return `X ${number(value.acceleration.x ?? value.accelerationIncludingGravity.x)}  Y ${number(value.acceleration.y ?? value.accelerationIncludingGravity.y)}  Z ${number(value.acceleration.z ?? value.accelerationIncludingGravity.z)}`; }
      case 'orientation': { const value = values.orientation!; return `α ${number(value.alpha)}  β ${number(value.beta)}  γ ${number(value.gamma)}`; }
      case 'location': { const value = values.location!; return `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`; }
      case 'pointer': { const value = values.pointer!; return `${value.pointerType} · ${value.x ?? '—'}, ${value.y ?? '—'}`; }
      case 'viewport': { const value = values.viewport!; return `${Math.round(value.width)} × ${Math.round(value.height)}`; }
      case 'visibility': return values.visibility === 'visible' ? 'Page visible' : 'Page hidden';
    }
  }
  function rawValue(name: SensorName): string {
    const value = name === 'motion' ? values.motion : name === 'orientation' ? values.orientation : name === 'location' ? values.location : name === 'pointer' ? values.pointer : name === 'viewport' ? values.viewport : values.visibility;
    return value === null ? 'No sensor data received yet' : JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toFixed(2)) : item);
  }
  function number(value: number | null) { return value === null ? '—' : value.toFixed(1); }
  function statusText(state: string) {
    if (state === 'permission-required') return 'PERMISSION NEEDED';
    if (state === 'denied') return 'ACCESS DENIED';
    if (state === 'unsupported') return 'NOT AVAILABLE';
    if (state === 'waiting' || state === 'active') return 'WAITING FOR SIGNAL';
    if (state === 'error') return 'CHECK SETTINGS';
    if (state === 'paused') return 'PAUSED';
    if (state === 'stopped') return 'STOPPED';
    return 'READY';
  }
  function detectorActive(name: DetectorName): boolean | null {
    if (name === 'shake') return detectorState.shaking;
    if (name === 'movement') return detectorState.moving;
    if (name === 'stationary') return detectorState.stationary;
    if (name === 'tilt') return detectorState.tilting;
    return detectorState.rotating;
  }
  function jumpTo(index: number) { step = Math.min(sensorOrder.length - 1, Math.max(0, index)); }
</script>

<section class="sensor-wizard" aria-label="Guided sensor test">
  <header class="wizard-heading">
    <div><p class="eyebrow">GUIDED SENSOR TEST</p><h1>Choose a sensor</h1></div>
    <span class="step-count">{String(step + 1).padStart(2, '0')}<small> / 06</small></span>
  </header>
  <nav class="sensor-picker" aria-label="Choose a sensor">
    {#each sensorOrder as sensor, index}
      <button class:selected={step === index} class:verified={statuses[sensor].state === 'active' && hasReading(sensor)} onclick={() => jumpTo(index)} aria-pressed={step === index}>
        <i></i><span>{sensorInfo[sensor].title}</span>
      </button>
    {/each}
  </nav>
  <div class="progress-track" aria-label={`Sensor ${step + 1} of ${sensorOrder.length}`}><i style={`width:${((step + 1) / sensorOrder.length) * 100}%`}></i></div>

  <div class="current-sensor">
    <div><p>STEP {String(step + 1).padStart(2, '0')} · {info.short.toUpperCase()}</p><h2>{info.title}</h2><code>{info.api}</code></div>
    <span class="state-badge" class:passed>{passed ? 'PASS' : sensorStatus.state.toUpperCase()}</span>
  </div>

  <section class="checklist-card" aria-label="Test instructions">
    <ol class="checklist-steps">{#each checklist as label, index}<li class:current={index === 0} class:done={index === 0 && sensorStatus.state === 'active'}><i>{index === 0 && sensorStatus.state === 'active' ? '✓' : String(index + 1).padStart(2, '0')}</i><span>{label}</span></li>{/each}</ol>
    <div class="instruction"><span class="instruction-icon">{selectedSensor === 'location' ? '⌖' : selectedSensor === 'pointer' ? '◎' : '⌁'}</span><div><strong>{info.action}</strong><p>{instructions}</p></div></div>
  </section>

  {#if selectedSensor === 'pointer' && !passed}
    <button class="touch-pad" onclick={() => onTest(selectedSensor)}><span>◎</span><strong>Touch to start, then drag here</strong><small>Pointer coordinates appear after your first touch.</small></button>
  {:else}
    <section class="reading-card" class:passed aria-live="polite">
      <div class="status-light" class:green={passed}><i></i></div>
      <div class="reading-copy"><span>{stateText}</span><strong>{headline}{#if hasReading(selectedSensor) && selectedSensor !== 'location' && selectedSensor !== 'pointer' && selectedSensor !== 'visibility'}<small> {info.unit}</small>{/if}</strong><small>{passed ? 'Your device is sending sensor data.' : 'Start the check and follow the instruction.'}</small></div>
      <details class="raw-detail"><summary>DATA</summary><pre>{raw}</pre></details>
    </section>
  {/if}

  <button class="start-button" onclick={() => onTest(selectedSensor)} disabled={sensorStatus.state === 'unsupported'}>{passed ? 'Test again' : sensorStatus.state === 'denied' ? 'Access denied' : selectedSensor === 'motion' || selectedSensor === 'orientation' || selectedSensor === 'location' ? 'Allow & start test' : 'Start sensor test'}<span>↗</span></button>

  <section class="detector-section" aria-label="Detected motion events">
    <div class="section-title"><strong>DETECTORS</strong><small>EVENTS</small></div>
    <div class="detector-list">{#each detectorNames as name}<span class:active={detectorActive(name) === true} class:unknown={detectorActive(name) === null}><i></i>{detectorLabels[name]}</span>{/each}</div>
  </section>
  <section class="events-section" aria-label="Recent sensor events">
    <div class="section-title"><strong>RECENT EVENTS <small>{events.length}</small></strong><button onclick={onClearEvents} disabled={!events.length}>CLEAR</button></div>
    {#if events.length}<ol class="event-list">{#each events.slice(0, 2) as event (event.id)}<li><time>{event.time}</time><strong>{event.name}</strong><span>{event.source === 'motion' ? 'Motion' : 'Orientation'}</span><small>{event.intensity.toFixed(1)}</small></li>{/each}</ol>{:else}<p class="empty-events">{simulated ? 'Demo signals will trigger sample events.' : 'Move your phone to detect an event.'}</p>{/if}
  </section>

  <nav class="step-navigation" aria-label="Sensor sequence"><button onclick={() => jumpTo(step - 1)} disabled={step === 0}>← Previous</button><span>{simulated ? 'DEMO INPUT' : 'LIVE DEVICE'}</span><button onclick={() => jumpTo(step + 1)} disabled={step === sensorOrder.length - 1}>Next →</button></nav>
</section>

<style>
  .sensor-wizard{display:flex;flex:1;min-height:0;flex-direction:column;gap:7px;padding:10px 1px 8px;overflow:hidden;color:#323a34}
  .wizard-heading{display:flex;flex:none;justify-content:space-between;align-items:flex-end;min-height:42px}.eyebrow{margin:0 0 4px;color:#829184;font:9px ui-monospace,monospace;letter-spacing:.12em;font-weight:700}.wizard-heading h1{margin:0;font-size:23px;line-height:1.08;letter-spacing:-.055em}.step-count{color:#596b5c;font:16px ui-monospace,monospace}.step-count small{color:#999b92;font-size:9px}
  .sensor-picker{display:flex;flex:none;gap:5px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.sensor-picker::-webkit-scrollbar{display:none}.sensor-picker button{display:flex;flex:none;align-items:center;gap:6px;min-height:39px;padding:0 9px;border:1px solid #dcddd4;border-radius:9px;background:#faf9f4;color:#7e8379;font-size:12px;font-weight:650}.sensor-picker button.selected{border-color:#809084;background:#e6eae2;color:#37443a}.sensor-picker button i{width:7px;height:7px;border-radius:50%;background:#b8b9ad}.sensor-picker button.verified i{background:#43a769;box-shadow:0 0 6px #43a76980}.sensor-picker button.selected.verified{border-color:#8bc89b;background:#eff7ef;color:#317a47}
  .progress-track{flex:none;height:4px;border-radius:5px;background:#e4e4dc;overflow:hidden}.progress-track i{display:block;height:100%;border-radius:5px;background:#88978a;transition:width .2s}
  .current-sensor{display:flex;flex:none;justify-content:space-between;align-items:center;min-height:50px}.current-sensor p{margin:0 0 3px;color:#898e84;font:9px ui-monospace,monospace;letter-spacing:.1em}.current-sensor h2{margin:0;color:#333a34;font-size:23px;line-height:1.05;letter-spacing:-.045em}.current-sensor code{display:block;margin-top:4px;color:#81867d;font:10px ui-monospace,monospace}.state-badge{flex:none;padding:7px 9px;border:1px solid #dedfd7;border-radius:18px;color:#777e74;font:9px ui-monospace,monospace;letter-spacing:.05em}.state-badge.passed{border-color:#a6d5b2;background:#eff8ef;color:#2f7d48}
  .checklist-card{flex:none;padding:9px 11px;border:1px solid #d9dad1;border-radius:12px;background:#faf9f4}.checklist-steps{display:flex;justify-content:space-between;margin:0;padding:0 0 8px;border-bottom:1px solid #e8e7df;list-style:none}.checklist-steps li{display:flex;flex-direction:column;align-items:center;gap:4px;color:#898d83;font-size:10px}.checklist-steps i{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#efeee8;color:#777d73;font:9px ui-monospace,monospace;font-style:normal}.checklist-steps li.current{color:#607362}.checklist-steps li.current i{background:#dce4d9;color:#5d735e}.checklist-steps li.done i{background:#43a769;color:white}.instruction{display:flex;align-items:center;gap:10px;padding-top:9px}.instruction-icon{display:grid;flex:none;place-items:center;width:36px;height:36px;border-radius:10px;background:#e5e9df;color:#758778;font-size:21px}.instruction strong{display:block;font-size:14px;line-height:1.2}.instruction p{margin:4px 0 0;color:#73796f;font-size:11px;line-height:1.35}
  .reading-card{position:relative;display:flex;flex:1;min-height:95px;align-items:center;gap:12px;padding:12px;border:1px solid #d9dad1;border-radius:13px;background:#f0efe9;overflow:hidden}.reading-card.passed{border-color:#a5d3b0;background:#eef7ef}.status-light{display:grid;flex:none;place-items:center;width:48px;height:48px;border:1px solid #d0d1c7;border-radius:50%;background:#e4e3db}.status-light i{width:18px;height:18px;border-radius:50%;background:#b2b4a9;box-shadow:0 0 0 6px #b2b4a922}.status-light.green{border-color:#91c99e;background:#dff1e2;box-shadow:0 0 0 4px #43a76912}.status-light.green i{background:#43a769;box-shadow:0 0 0 7px #43a76927,0 0 20px #43a769aa;animation:glow 1.25s ease-in-out infinite alternate}.reading-copy{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}.reading-copy>span{color:#7e847b;font:10px ui-monospace,monospace;letter-spacing:.08em}.reading-card.passed .reading-copy>span{color:#307b46}.reading-copy strong{font-size:15px;line-height:1.25;overflow-wrap:anywhere}.reading-copy strong small{color:#82887e;font-size:10px;font-weight:500}.reading-copy>small{color:#7f857b;font-size:10px;line-height:1.3}.raw-detail{position:absolute;right:8px;top:7px;max-width:50%}.raw-detail summary{color:#7f847a;font:8px ui-monospace,monospace;letter-spacing:.06em;cursor:pointer;list-style:none}.raw-detail pre{position:absolute;z-index:3;right:0;top:12px;width:min(300px,75vw);max-height:150px;overflow:auto;margin:0;padding:8px;border:1px solid #d4d6cd;border-radius:8px;background:#fbfaf5;color:#72776f;font:9px/1.4 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 5px 18px #0002}
  .touch-pad{display:flex;flex:1;min-height:85px;align-items:center;justify-content:center;flex-direction:column;gap:4px;border:1px dashed #bfc7bb;border-radius:13px;background:#edf0e9;color:#758676}.touch-pad>span{font-size:19px}.touch-pad strong{color:#4f5b51;font-size:12px}.touch-pad small{color:#858a80;font-size:8px}
  .start-button{display:flex;flex:none;align-items:center;justify-content:space-between;min-height:48px;padding:0 14px;border:0;border-radius:10px;background:#849387;color:white;font-size:15px;font-weight:700}.start-button:disabled{opacity:.45}.start-button span{font-size:19px}
  .detector-section,.events-section{flex:none;padding:8px 10px;border:1px solid #dedfd6;border-radius:10px;background:#faf9f4}.section-title{display:flex;align-items:center;justify-content:space-between;color:#778176;font:10px ui-monospace,monospace;letter-spacing:.08em}.section-title>strong{font-weight:650}.section-title small{margin-left:4px;color:#91958a;font-size:9px}.section-title button{border:0;background:transparent;color:#80857b;font:10px ui-monospace,monospace}.section-title button:disabled{opacity:.45}.detector-list{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.detector-list span{display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:6px;background:#f0efe9;color:#7e847b;font-size:10px}.detector-list i{width:6px;height:6px;border-radius:50%;background:#b7b9ae}.detector-list span.active{background:#e3f0e4;color:#347e49}.detector-list span.active i{background:#43a769}.detector-list span.unknown{color:#969990}
  .empty-events{margin:6px 0 0;color:#858a81;font-size:10px}.event-list{display:flex;flex-direction:column;gap:3px;margin:5px 0 0;padding:0;list-style:none}.event-list li{display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid #ecebe4;color:#747970;font-size:10px}.event-list time{width:48px;color:#878b81;font:8px ui-monospace,monospace}.event-list strong{flex:1;color:#536955;font-size:11px}.event-list small{color:#7f847a;font:8px ui-monospace,monospace}.step-navigation{display:flex;flex:none;align-items:center;justify-content:space-between;padding-top:1px}.step-navigation button{min-height:29px;padding:0 3px;border:0;background:transparent;color:#657567;font-size:11px;font-weight:650}.step-navigation button:disabled{color:#b8bab1}.step-navigation span{color:#898d83;font:8px ui-monospace,monospace;letter-spacing:.08em}
  @keyframes glow{to{box-shadow:0 0 0 9px #43a76910,0 0 27px #43a769bb}}
  @media(max-height:740px){.sensor-wizard{gap:5px;padding-top:6px}.wizard-heading{min-height:36px}.wizard-heading h1{font-size:21px}.sensor-picker button{min-height:31px}.current-sensor{min-height:42px}.checklist-card{padding:6px 8px}.instruction{padding-top:6px}.reading-card{min-height:74px;padding:8px}.status-light{width:38px;height:38px}.start-button{min-height:38px}.detector-section,.events-section{padding:5px 8px}.detector-list{margin-top:4px}.event-list li{padding:3px 0}}
  @media(max-width:360px){.sensor-picker{gap:3px}.sensor-picker button{padding:0 6px;font-size:9px}.reading-copy strong{font-size:12px}.detector-list{gap:3px}.detector-list span{padding:3px 4px;font-size:7px}}
</style>
