<script lang="ts">
  import type { LocationData, MotionData, MotionDirection, OrientationData, PointerData, SensorName, TiltDirection } from '@mobile-sensor/core';

  type Values = { motion: MotionData | null; orientation: OrientationData | null; location: LocationData | null; pointer: PointerData | null };
  let { sensor, values, direction, tiltDirection, shaking, leftPressed, rightPressed, passed }: { sensor: SensorName; values: Values; direction: MotionDirection | null; tiltDirection: TiltDirection | null; shaking: boolean; leftPressed: boolean; rightPressed: boolean; passed: boolean } = $props();

  let motion = $derived(values.motion);
  let orientation = $derived(values.orientation);
  let location = $derived(values.location);
  let pointer = $derived(values.pointer);
  let angle = $derived(Math.max(-34, Math.min(34, (motion?.acceleration.x ?? motion?.accelerationIncludingGravity.x ?? 0) * 1.7)));
  let shiftX = $derived(Math.max(-26, Math.min(26, (motion?.acceleration.x ?? 0) * 1.8)));
  let shiftY = $derived(Math.max(-18, Math.min(18, (motion?.acceleration.y ?? 0) * 1.8)));
  let tiltX = $derived(Math.max(-32, Math.min(32, orientation?.gamma ?? 0)));
  let tiltY = $derived(Math.max(-25, Math.min(25, orientation?.beta ?? 0)));
  const directionLabels: Record<MotionDirection, string> = { up: 'UP ↑', down: 'DOWN ↓', left: 'LEFT ←', right: 'RIGHT →', 'rotate-left': 'ROTATE LEFT ↶', 'rotate-right': 'ROTATE RIGHT ↷' };
  const tiltLabels: Record<TiltDirection, string> = { forward: 'FORWARD ↘', backward: 'BACKWARD ↖', left: 'LEFT ←', right: 'RIGHT →' };
</script>

<section class="visual" class:passed data-testid="sensor-visual" data-visual={sensor} aria-label={`${sensor} visual feedback`}>
  {#if sensor === 'motion'}
    <div class="motion-stage" class:signal={motion !== null}>
      <svg class="motion-trail" viewBox="0 0 320 180" aria-hidden="true"><path d="M30 126 C75 126 78 53 124 67 S184 143 220 99 S268 32 294 43" /><path class="trail-soft" d="M30 145 C78 144 92 85 130 91 S183 132 222 119 S270 69 294 77" /></svg>
      <span class="motion-orbit orbit-one"></span><span class="motion-orbit orbit-two"></span>
      <div class="phone-graphic" style={`transform:translate(${shiftX}px, ${shiftY}px) rotate(${angle}deg)`} aria-hidden="true"><i></i><span></span><b></b></div>
      <div class="axis axis-x"><i></i><span>X</span></div><div class="axis axis-y"><i></i><span>Y</span></div>
      <div class="motion-direction" class:detected={direction !== null || shaking} data-testid="motion-direction" data-direction={shaking ? 'shake' : direction ?? 'waiting'} aria-live="polite"><small>{shaking ? 'MOTION' : 'DIRECTION'}</small><strong>{shaking ? 'SHAKE ↕' : direction ? directionLabels[direction] : 'WAITING'}</strong></div>
      <span class="visual-caption">{shaking ? 'SHAKE DETECTED' : direction ? 'DIRECTION DETECTED' : motion ? 'MOVE OR ROTATE YOUR PHONE' : 'MOVE DEVICE TO TRACE'}</span>
    </div>
  {:else if sensor === 'orientation'}
    <div class="orientation-stage" class:signal={orientation !== null}>
      <div class="compass-ring"><i class="north">N</i><i class="east">E</i><i class="south">S</i><i class="west">W</i><span class="compass-needle"></span></div>
      <div class="level-line"><span style={`transform:translateY(${tiltY * 1.15}px) rotate(${tiltX}deg)`}></span><i></i></div>
      <div class="phone-graphic orientation-phone" style={`transform:perspective(420px) rotateX(${-tiltY}deg) rotateY(${tiltX}deg)`} aria-hidden="true"><i></i><span></span><b></b></div>
      <div class="tilt-direction" class:detected={tiltDirection !== null} data-testid="orientation-tilt-direction" data-tilt-direction={tiltDirection ?? 'waiting'} aria-live="polite"><small>TILT</small><strong>{tiltDirection ? tiltLabels[tiltDirection] : 'WAITING'}</strong></div>
      <span class="visual-caption">{orientation ? 'LIVE DEVICE TILT' : 'TILT DEVICE TO MOVE THE LEVEL'}</span>
    </div>
  {:else if sensor === 'location'}
    <div class="map-stage" class:signal={location !== null}>
      <div class="map-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <svg class="map-roads" viewBox="0 0 320 180" aria-hidden="true"><path d="M0 122 91 70l70 35 73-74 86 41M34 180l58-110-8-70m102 180-25-75 91-74M211 180l21-55 88-41" /></svg>
      <span class="location-pulse pulse-one"></span><span class="location-pulse pulse-two"></span>
      <div class="map-pin" aria-hidden="true"><span>⌖</span></div>
      <div class="map-coordinate">{location ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°` : 'WAITING FOR POSITION'}</div>
      <span class="visual-caption">{location ? 'POSITION FOUND' : 'LOCATION STAYS ON DEVICE'}</span>
    </div>
  {:else if sensor === 'pointer'}
    <div class="touch-stage" class:signal={pointer !== null} data-testid="touch-zones">
      <div class="touch-grid" aria-hidden="true"></div><span class="touch-cross cross-x"></span><span class="touch-cross cross-y"></span>
      <div class="touch-zones-layout">
        <div class="touch-zone" class:pressed={leftPressed} data-testid="touch-left-zone" data-pressed={leftPressed ? 'true' : 'false'}><small>LEFT</small><strong>{leftPressed ? 'PRESSED' : 'PRESS'}</strong></div>
        <div class="touch-dead-zone"><span>100 PX<br />NO INPUT</span></div>
        <div class="touch-zone" class:pressed={rightPressed} data-testid="touch-right-zone" data-pressed={rightPressed ? 'true' : 'false'}><small>RIGHT</small><strong>{rightPressed ? 'PRESSED' : 'PRESS'}</strong></div>
      </div>
      <span class="touch-label" data-testid="touch-state" aria-live="polite">{leftPressed && rightPressed ? 'BOTH SIDES PRESSED' : leftPressed ? 'LEFT PRESSED' : rightPressed ? 'RIGHT PRESSED' : pointer ? `${pointer.pointerType.toUpperCase()} · ${Math.round(pointer.x ?? 0)}, ${Math.round(pointer.y ?? 0)}` : 'PRESS LEFT OR RIGHT'}</span>
    </div>
  {/if}
</section>

<style>
  .visual{position:relative;display:grid;flex:1;min-height:150px;place-items:center;overflow:hidden;border:1px solid #dedfd5;border-radius:16px;background:linear-gradient(145deg,#f7f6ef,#ecece3);color:#718578;transition:background .35s,border-color .35s}
  .visual.passed{border-color:#a9d0ad;background:linear-gradient(145deg,#f1f8ee,#e5f1e5)}
  .visual:after{position:absolute;inset:0;pointer-events:none;content:"";background:radial-gradient(circle at 50% 48%,#fff9,transparent 62%)}
  .motion-stage,.orientation-stage,.map-stage,.touch-stage{position:relative;display:grid;width:100%;height:100%;min-height:150px;place-items:center;overflow:hidden}
  .motion-stage{background:radial-gradient(ellipse at 50% 56%,#fff9,transparent 70%)}
  .motion-direction{position:absolute;z-index:4;top:9px;left:50%;display:flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid #d8dfd5;border-radius:7px;background:#f8f9f2dd;color:#829080;transform:translateX(-50%);white-space:nowrap}.motion-direction small{font:8px ui-monospace,monospace;letter-spacing:.08em}.motion-direction strong{font-size:12px;letter-spacing:.04em}.motion-direction.detected{border-color:#9bb89b;background:#edf5e9;color:#3f7749}.motion-direction.detected strong{font-size:14px}
  .motion-trail{position:absolute;width:94%;height:90%;inset:5% 3%;overflow:visible}.motion-trail path{fill:none;stroke:#a3b2a3;stroke-width:2;stroke-dasharray:5 7;opacity:.85}.motion-trail .trail-soft{stroke:#c4cec1;stroke-width:1.4;stroke-dasharray:2 8}.motion-stage.signal .motion-trail path{stroke:#68a477;animation:trace-draw 1.5s ease-in-out infinite alternate}
  .motion-orbit{position:absolute;width:166px;height:72px;border:1px solid #d3ddd0;border-radius:50%;transform:rotate(-24deg)}.orbit-two{width:140px;height:92px;transform:rotate(30deg);border-style:dashed;opacity:.65}
  .phone-graphic{position:relative;z-index:1;width:50px;height:91px;border:3px solid #728377;border-radius:13px;background:linear-gradient(160deg,#e8ede3,#cbd7ca);box-shadow:0 10px 24px #5266572a, inset 0 0 0 2px #f8f9f2;transition:transform .18s ease-out}.phone-graphic:before{content:"";position:absolute;top:5px;left:50%;width:13px;height:3px;border-radius:5px;background:#8b9a8c;transform:translateX(-50%)}.phone-graphic i{position:absolute;inset:16px 6px 25px;border:1px solid #a3b19f;border-radius:5px;background:linear-gradient(140deg,#dce6d8,#f5f5ed)}.phone-graphic span{position:absolute;left:9px;right:9px;bottom:11px;height:4px;border-radius:5px;background:#a1b29f}.phone-graphic b{position:absolute;left:50%;bottom:3px;width:3px;height:3px;border-radius:50%;background:#718578;transform:translateX(-50%)}
  .axis{position:absolute;z-index:2;display:flex;align-items:center;gap:4px;color:#8a9a8a;font:9px ui-monospace,monospace}.axis i{width:28px;height:1px;background:#aab9a9}.axis-x{right:19%;top:37%}.axis-y{left:20%;bottom:33%;transform:rotate(90deg)}.visual-caption{position:absolute;z-index:2;bottom:12px;color:#849183;font:8px ui-monospace,monospace;letter-spacing:.12em}
  .orientation-stage{background:radial-gradient(circle at 50% 48%,#fdfdf7 0 15%,transparent 16%),linear-gradient(#eff0e8,#e5e8de)}.compass-ring{position:absolute;width:148px;height:148px;border:1px solid #cbd4c8;border-radius:50%;box-shadow:0 0 0 12px #e9eee6,0 0 0 13px #d7dfd4}.compass-ring:before,.compass-ring:after{position:absolute;content:"";background:#cbd4c8}.compass-ring:before{left:50%;top:0;bottom:0;width:1px}.compass-ring:after{top:50%;left:0;right:0;height:1px}.compass-ring i{position:absolute;z-index:1;color:#829184;font:8px ui-monospace,monospace;font-style:normal}.north{top:7px;left:50%;transform:translateX(-50%)}.south{bottom:7px;left:50%;transform:translateX(-50%)}.east{right:7px;top:50%;transform:translateY(-50%)}.west{left:7px;top:50%;transform:translateY(-50%)}.compass-needle{position:absolute;z-index:1;top:12px;left:50%;width:2px;height:61px;background:linear-gradient(#7da180 50%,#d1d9cd 50%);transform:translateX(-50%);transform-origin:bottom center;transition:transform .3s}.level-line{position:absolute;z-index:2;display:grid;place-items:center;width:128px;height:38px;border:1px solid #c7d0c2;border-radius:25px;background:#f8f9f3;box-shadow:0 5px 15px #40513f18}.level-line span{width:84px;height:2px;background:#8fa28d;transition:transform .2s}.level-line i{position:absolute;width:9px;height:9px;border:2px solid #758a76;border-radius:50%;background:#f8faf4}.orientation-phone{width:39px;height:68px;opacity:.36;transform-origin:center}
  .tilt-direction{position:absolute;z-index:4;top:9px;left:50%;display:flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid #d8dfd5;border-radius:7px;background:#f8f9f2dd;color:#829080;transform:translateX(-50%);white-space:nowrap}.tilt-direction small{font:8px ui-monospace,monospace;letter-spacing:.08em}.tilt-direction strong{font-size:12px}.tilt-direction.detected{border-color:#9bb89b;background:#edf5e9;color:#3f7749}.tilt-direction.detected strong{font-size:14px}
  .map-stage{background:#eef1e8}.map-grid{position:absolute;inset:0;background-image:linear-gradient(0deg,transparent 48%,#e1e7db 49%,#e1e7db 51%,transparent 52%),linear-gradient(90deg,transparent 48%,#e1e7db 49%,#e1e7db 51%,transparent 52%);background-size:42px 42px;opacity:.7}.map-roads{position:absolute;inset:0;width:100%;height:100%}.map-roads path{fill:none;stroke:#d1dacd;stroke-width:9;stroke-linecap:round;stroke-linejoin:round}.map-stage.signal .map-roads path{stroke:#c4d6c1}.map-pin{position:absolute;z-index:2;display:grid;place-items:center;width:42px;height:42px;border:1px solid #96a892;border-radius:50% 50% 50% 5px;background:#f8faf3;color:#657e68;font-size:24px;transform:translateY(-8px) rotate(-45deg);box-shadow:0 6px 18px #4d714322}.map-pin span{transform:rotate(45deg)}.location-pulse{position:absolute;width:55px;height:55px;border:1px solid #8aab8b;border-radius:50%;opacity:0}.map-stage.signal .location-pulse{animation:radar 2s ease-out infinite}.map-stage.signal .pulse-two{animation-delay:1s}.map-coordinate{position:absolute;z-index:2;top:12px;left:12px;padding:6px 8px;border:1px solid #d5ddd0;border-radius:6px;background:#f8f8f1cc;color:#718370;font:8px ui-monospace,monospace}
  .touch-stage{background:radial-gradient(ellipse at center,#f8faf2,#e8ece4)}.touch-grid{position:absolute;inset:12px;border:1px dashed #bdcbbb;border-radius:12px;background-image:linear-gradient(#d9e0d5 1px,transparent 1px),linear-gradient(90deg,#d9e0d5 1px,transparent 1px);background-size:24px 24px}.touch-cross{position:absolute;background:#a1b39e;opacity:.25}.cross-x{left:50%;top:0;bottom:0;width:1px}.cross-y{left:0;right:0;top:50%;height:1px}.touch-zones-layout{position:relative;z-index:2;display:grid;width:92%;height:84px;grid-template-columns:minmax(0,1fr) minmax(52px,25.64%) minmax(0,1fr);align-items:stretch}.touch-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:1px solid #ccd5ca;background:#f8f9f2d9;color:#879486}.touch-zone:first-child{border-radius:10px 0 0 10px}.touch-zone:last-child{border-radius:0 10px 10px 0}.touch-zone small{font:8px ui-monospace,monospace;letter-spacing:.12em}.touch-zone strong{font-size:12px;letter-spacing:.04em}.touch-zone.pressed{border-color:#8eb995;background:#e8f3e5;color:#478354;box-shadow:inset 0 0 0 1px #b3d0b3}.touch-zone.pressed strong{font-size:14px}.touch-dead-zone{display:grid;place-items:center;background:#ecece3;color:#9a9d92;text-align:center}.touch-dead-zone span{font:7px/1.35 ui-monospace,monospace;letter-spacing:.03em}.touch-label{position:absolute;z-index:2;bottom:12px;color:#819181;font:8px ui-monospace,monospace;letter-spacing:.08em}
  @keyframes trace-draw{to{stroke-dashoffset:-42;stroke:#6c9c73}}
  @keyframes radar{0%{transform:scale(.42);opacity:.7}100%{transform:scale(2.25);opacity:0}}
  @keyframes tap-ripple{0%{opacity:.8;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
  @media(max-height:740px){.visual,.motion-stage,.orientation-stage,.map-stage,.touch-stage{min-height:112px}.compass-ring{width:116px;height:116px}.level-line{width:104px}.phone-graphic{transform:scale(.83)}}
</style>
