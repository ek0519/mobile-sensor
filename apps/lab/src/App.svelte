<script lang="ts">
  import { onMount } from 'svelte';
  import { createSensors, createSensorRecorder, createBehaviorEngine, extractMotionWindowFeatures, replaySensorRecording } from '@mobile-sensor/core';
  import type { Sensors, SensorRecorder, SensorRecord, BehaviorEvent, DetectorEvent, MotionWindowFeatures } from '@mobile-sensor/core';
  import { createSessionUploader } from './lib/api';
  import { downloadSession, parseRecording } from './lib/session';
  import type { LabSession } from './lib/session';
  let sensors: Sensors | undefined;
  let recorder: SensorRecorder | undefined;
  const engine=createBehaviorEngine();
  let enabled=$state(false), recording=$state(false), includeLocation=$state(false), busy=$state(false);
  let label=$state('pickup'), custom=$state(''), error=$state(''), uploadStatus=$state('Local only'), samples=$state(0);
  let session=$state<LabSession | null>(null), features=$state<MotionWindowFeatures | null>(null);
  let raw=$state<Partial<Record<SensorRecord['sensor'], SensorRecord['data']>>>({});
  let statuses=$state('Sensors are off');
  let timeline=$state<{t:number; text:string}[]>([]), latestT=0;
  let replayText=$state(''), speed=$state(0), replaying=$state(false);
  let controller: AbortController | undefined;
  let uploader: ReturnType<typeof createSessionUploader> | undefined;
  let uploaded=0;
  const labels=['stationary','pickup','putdown','flip','handling','walking','running','shake','rotate','custom'];
  function log(text: string) { timeline=[...timeline.slice(-299),{t:latestT,text}]; }
  engine.onDetector((e: DetectorEvent)=>log(`${e.type} ${e.tiltDirection ?? e.screenFace ?? e.direction ?? ''}`));
  for(const type of ['pickup','putdown','flip','handling','walking'] as const) engine.on(type,(e: BehaviorEvent)=>log(`${e.type} score ${e.confidence.toFixed(2)} ${e.metadata?.active === false ? '(inactive)' : ''}`));
  function process(r: SensorRecord) { latestT=r.t;raw={...raw,[r.sensor]:r.data};engine.processSensorRecord(r); }
  function sync() {
    if(!recorder || !session) return;
    const records=recorder.getRecords();
    const fresh=records.slice(uploaded);
    for(const r of fresh) process(r);
    uploader?.enqueue(fresh);uploaded=records.length;samples=records.length;
    features=extractMotionWindowFeatures(records);
    if(recording && !recorder.isRecording()) { error='Record limit reached. Recording stopped; save or export the session.';void stop(); }
  }
  onMount(()=> {
    sensors=createSensors();
    const unsub=sensors.status.subscribe(status=>{statuses=Object.entries(status).map(([name,s])=>`${name}: ${s.state}${s.error ? ' ('+s.error+')' : ''}`).join(' · ');});
    const timer=setInterval(()=>{if(recording) sync();},100);
    return ()=>{clearInterval(timer);unsub();recorder?.stop();uploader?.dispose();controller?.abort();engine.reset();sensors?.destroy();};
  });
  async function enable() {
    if(!sensors) return;
    // Native permission calls run synchronously in this click handler before its first await.
    const permission=sensors.requestPermission();busy=true;error='';
    try {await permission;await sensors.start({location:includeLocation});enabled=true;} catch(e) {error=String(e);} finally {busy=false;}
  }
  async function start() {
    if(!sensors || !enabled) return;
    const selected=label==='custom' ? custom.trim() : label;
    if(!selected) {error='Enter a custom label';return;}
    error='';engine.reset();timeline=[];raw={};features=null;uploaded=samples=0;uploader?.dispose();uploader=undefined;
    recorder=createSensorRecorder(sensors,{includeLocation});recorder.start();
    const startedAt=Date.now();
    session={startedAt,endedAt:startedAt,records:[],metadata:{schemaVersion:1,id:crypto.randomUUID(),label:selected,startedAt,includeLocation,capabilities:sensors.capabilities(),device:{userAgent:navigator.userAgent,platform:navigator.platform || null,language:navigator.language || null,screen:{width:screen.width,height:screen.height,devicePixelRatio:devicePixelRatio}}}};
    recording=true;uploadStatus='Local recording — upload starts on Stop & Save';
  }
  async function save() {
    if(!session || busy) return;
    busy=true;error='';uploadStatus='Uploading…';
    try {
      if(!uploader) {
        uploader=createSessionUploader(import.meta.env.VITE_SENSOR_LAB_API,$state.snapshot(session.metadata),{onStatus:s=>uploadStatus=s});
        // Queue the entire local session once; failed batches remain in this uploader.
        uploader.enqueue($state.snapshot(session.records));
      }
      await uploader.start();await uploader.finish(session.endedAt);
    } catch(e) {error=String(e);uploadStatus='Upload failed — retained locally';uploader?.dispose();} finally {busy=false;}
  }
  async function stop() {
    if(!recorder || !session) return;
    recording=false;sync();const result=recorder.stop();session={...result,metadata:session.metadata};samples=result.records.length;
    engine.reset();await save();
  }
  function load(text: string) {
    if(recording || busy || replaying) return;
    try {const parsed=parseRecording(text);session=parsed;uploader?.dispose();uploader=undefined;raw={};timeline=[];samples=parsed.records.length;uploadStatus='Loaded locally';error='';} catch(e) {error=String(e);}
  }
  async function replay() {
    if(!session) return;
    controller=new AbortController();engine.reset();timeline=[];raw={};replaying=true;error='';
    try {await replaySensorRecording(session,{speed,signal:controller.signal,onRecord:process});features=extractMotionWindowFeatures(session.records);} catch(e) {if(!controller.signal.aborted) error=String(e);} finally {engine.reset();replaying=false;}
  }
</script>

<svelte:head><title>Mobile Sensor · Behavior Lab</title></svelte:head>
<main>
  <header><p class="eyebrow">MOBILE SENSOR / RESEARCH TOOL</p><h1>Behavior Lab</h1><p>Record physical actions. Inspect raw signals. Replay experimental behavior estimates.</p></header>
  <section>
    <h2>1. Enable sensors</h2>
    <label class="check"><input type="checkbox" bind:checked={includeLocation} disabled={enabled || recording || busy}/> Include location recording (coordinates will be saved and uploaded)</label>
    <button onclick={enable} disabled={busy || recording || replaying}>{enabled ? 'Refresh permissions' : 'Enable Sensors'}</button>
    <button onclick={()=>{sensors?.stop();enabled=false;}} disabled={!enabled || recording || busy}>Disable Sensors</button>
    <p class="status">{statuses}</p>
    <p class="muted">Use HTTPS on phones. iOS permission requests happen when you press Enable Sensors. Location is off by default; disable sensors to change it.</p>
  </section>
  <section>
    <h2>2. Record an action</h2>
    <div class="labels">{#each labels as name}<button class:selected={label===name} disabled={recording || busy || replaying} onclick={()=>label=name}>{name}</button>{/each}</div>
    {#if label==='custom'}<label>Custom label <input bind:value={custom} disabled={recording || busy}/></label>{/if}
    <div class="actions"><button class="primary" onclick={start} disabled={!enabled || recording || busy || replaying}>Start Recording</button><button class="primary" onclick={stop} disabled={!recording}>Stop &amp; Save</button></div>
    <p aria-live="polite">{recording ? '● Recording' : 'Ready'} · {samples.toLocaleString()} samples · {uploadStatus}</p>
    {#if session && !recording}<p><strong>{session.metadata.label}</strong> · {((session.endedAt-session.startedAt)/1000).toFixed(2)} seconds</p><div class="actions"><button onclick={()=>session && downloadSession(session,'json')}>Download JSON</button><button onclick={()=>session && downloadSession(session,'ndjson')}>Download NDJSON</button><button onclick={save} disabled={busy || replaying || uploadStatus==='Upload complete'}>Retry / Upload session</button></div>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </section>
  <div class="grid">
    <section><h2>Raw sensors</h2><p class="muted">All available axes, original values and timestamps. Display updates at 10 Hz; recording preserves every sample.</p>{#each Object.entries(raw) as [name,data]}{#if name!=='location' || session?.metadata.includeLocation}<h3>{name}</h3><pre>{JSON.stringify(data,null,2)}</pre>{/if}{/each}</section>
    <section><h2>Motion features</h2><p class="muted">Rolling 2-second window</p><pre>{features ? JSON.stringify(features,null,2) : 'Waiting for samples'}</pre></section>
    <section><h2>Event timeline</h2><p class="muted">Experimental heuristics. Confidence is a detector score, not a calibrated probability. Handling indicates recent motion or interaction evidence.</p><div class="timeline" aria-live="polite">{#each timeline as event}<div><span>{event.t.toFixed(0)} ms</span> {event.text}</div>{/each}</div></section>
  </div>
  <section>
    <h2>3. Replay a recording</h2><p>Load exported JSON or paste a recording below. Replay runs locally.</p>
    <input aria-label="Load recording JSON" type="file" accept=".json,application/json" disabled={recording || busy || replaying} onchange={async e=>{const file=e.currentTarget.files?.[0];if(file) {if(file.size>60_000_000) {error='File exceeds 60 MB';return;}load(await file.text());}}}/>
    <textarea aria-label="Recording JSON" bind:value={replayText} placeholder="Paste exported Sensor Recording JSON" disabled={recording || busy || replaying}></textarea>
    <div class="actions"><button onclick={()=>load(replayText)} disabled={recording || busy || replaying}>Load Recording</button><label>Speed <select bind:value={speed} disabled={replaying}><option value={0}>Instant</option><option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option></select></label><button class="primary" onclick={replay} disabled={!session || recording || busy || replaying}>Replay</button><button onclick={()=>controller?.abort()} disabled={!replaying}>Cancel replay</button></div>
  </section>
</main>
<style>
  :global(body){margin:0;background:#eef2f3;color:#172b35;font-family:system-ui,sans-serif;} :global(*){box-sizing:border-box} main{max-width:1400px;margin:auto;padding:30px 20px} header{padding:12px 0 24px} h1{font-size:clamp(36px,6vw,60px);margin:6px 0} .eyebrow{letter-spacing:.14em;font-size:12px;color:#226d67} h2{font-size:21px;margin-top:0} h3{font-size:15px} section{min-width:0;overflow-wrap:anywhere;background:white;border:1px solid #d2dfe0;border-radius:16px;padding:22px;margin-bottom:18px} button,input,select,textarea{font:inherit} button{border:1px solid #b5c9ca;border-radius:8px;background:#f3f7f7;color:#183f3f;padding:11px 15px;cursor:pointer} button:hover{background:#e0eeee} button:disabled{opacity:.45;cursor:default}.primary,.selected{background:#176c62;color:white}.primary:hover,.selected:hover{background:#10584f}.labels,.actions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0} label{display:flex;align-items:center;gap:10px}.check{margin-bottom:16px} input:not([type=checkbox]),select,textarea{border:1px solid #b5c9ca;border-radius:6px;padding:8px;max-width:100%}textarea{display:block;width:100%;min-height:110px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.muted,.status{font-size:13px;color:#52656b;line-height:1.6}.error{color:#a12121;background:#fff1ee;padding:12px;border-radius:6px}pre{font-size:12px;overflow:auto;max-height:400px;background:#f2f6f6;padding:12px;border-radius:8px}.timeline{font-family:monospace;font-size:12px;max-height:450px;overflow:auto;line-height:1.9}.timeline span{color:#176c62;display:inline-block;min-width:74px}@media(max-width:950px){.grid{grid-template-columns:1fr}main{padding:20px 12px}}
</style>
