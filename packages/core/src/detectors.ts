import type { MotionData, DetectorEvent, DetectorOptions, Vector3, DeviceState, OrientationData, MotionDirection, TiltDirection, ScreenFace } from './types';
export const detectorDefaults: DetectorOptions = { shakeThreshold: 12, shakeWindow: 500, shakeCooldown: 1000, movementThreshold: 1.5, stationaryThreshold: 0.8, movementDuration: 150, stationaryDuration: 800, staleAfter: 1000, tiltThreshold: 20, tiltRelease: 15, rotationThreshold: 30, rotationRelease: 20, directionThreshold: 2.5, circleAccelerationThreshold: 0.8, circleSweepThreshold: 300, circleMinSamples: 10, circleWindow: 2500, directionCooldown: 400 };
export function detectors(options: Partial<DetectorOptions>, emit: (event: DetectorEvent) => void, update: (patch: Partial<DeviceState>) => void) {
  const config = { ...detectorDefaults, ...options };
  const nonNegative = ['shakeThreshold', 'shakeWindow', 'shakeCooldown', 'movementThreshold', 'stationaryThreshold', 'movementDuration', 'stationaryDuration', 'staleAfter', 'tiltThreshold', 'tiltRelease', 'rotationThreshold', 'rotationRelease', 'directionThreshold', 'circleAccelerationThreshold', 'circleSweepThreshold', 'circleMinSamples', 'circleWindow', 'directionCooldown'] as const;
  if (nonNegative.some(key => !Number.isFinite(config[key]) || config[key] < 0) || config.staleAfter === 0 || config.directionThreshold === 0 || config.circleAccelerationThreshold === 0 || config.circleWindow === 0 || config.circleSweepThreshold <= 180 || config.circleSweepThreshold > 360 || !Number.isInteger(config.circleMinSamples) || config.circleMinSamples < 8 || config.movementThreshold <= config.stationaryThreshold || config.tiltRelease > config.tiltThreshold || config.rotationRelease > config.rotationThreshold) {
    throw new RangeError('detector thresholds and durations must be finite and non-negative, with release thresholds below trigger thresholds');
  }
  let peak: { vector: number[]; time: number } | null = null;
  let lastShake = -Infinity;
  let candidate: 'movement' | 'stationary' | null = null;
  let candidateSince = 0;
  let moving: boolean | null = null;
  let stale: ReturnType<typeof setTimeout> | undefined;
  let tilting: boolean | null = null;
  let rotating: boolean | null = null;
  let tiltBaseline: { beta: number; gamma: number } | null = null;
  let tiltDirection: TiltDirection | null = null;
  let screenFace: ScreenFace | null = null;
  let faceCandidate: ScreenFace | null = null;
  let faceSince = 0;
  const resetFace = () => { screenFace = faceCandidate = null; update({ screenFace: null }); };
  let tiltTimer: ReturnType<typeof setTimeout> | undefined;
  let rotationTimer: ReturnType<typeof setTimeout> | undefined;
  let directionTimer: ReturnType<typeof setTimeout> | undefined;
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastDirectionAt = -Infinity;
  let lastCircleAt = -Infinity;
  let directionArmed = true;
  let circleTrace: { angle: number; startedAt: number; lastAt: number; signedSweep: number; totalSweep: number; samples: number } | null = null;
  let shaking: boolean | null = null;
  const resetMotion = () => { clearTimeout(stale); clearTimeout(directionTimer); clearTimeout(shakeTimer); stale = directionTimer = shakeTimer = undefined; peak = null; lastShake = -Infinity; candidate = null; moving = null; lastDirectionAt = lastCircleAt = -Infinity; directionArmed = true; circleTrace = null; shaking = null; update({ moving: null, stationary: null, shaking: null, movementIntensity: null, direction: null }); };
  const reset = () => { resetMotion(); resetFace(); clearTimeout(tiltTimer); clearTimeout(rotationTimer); tilting = rotating = null; tiltBaseline = null; tiltDirection = null; update({ tilting: null, tiltDirection: null, rotating: null }); };
  const reportDirection = (direction: MotionDirection, intensity: number, timestamp: number) => {
    lastDirectionAt = timestamp;
    clearTimeout(directionTimer);
    update({ direction });
    directionTimer = setTimeout(() => update({ direction: null }), config.staleAfter);
    emit({ type: 'direction', source: 'motion', timestamp, intensity, direction });
  };
  const detectCircle = (x: number | null, y: number | null, timestamp: number) => {
    if (x === null || y === null || Math.hypot(x, y) < config.circleAccelerationThreshold) { circleTrace = null; return null; }
    const angle = Math.atan2(y, x);
    const trace = circleTrace;
    if (!trace || timestamp - trace.startedAt > config.circleWindow || timestamp - trace.lastAt > Math.min(500, config.circleWindow)) {
      circleTrace = { angle, startedAt: timestamp, lastAt: timestamp, signedSweep: 0, totalSweep: 0, samples: 0 };
      return null;
    }
    const delta = angleDeltaRadians(angle, trace.angle);
    trace.angle = angle;
    trace.lastAt = timestamp;
    if (Math.abs(delta) < 0.04) return null;
    if (Math.abs(delta) > Math.PI * 0.75) {
      circleTrace = { angle, startedAt: timestamp, lastAt: timestamp, signedSweep: 0, totalSweep: 0, samples: 0 };
      return null;
    }
    trace.signedSweep += delta;
    trace.totalSweep += Math.abs(delta);
    trace.samples += 1;
    const sweep = Math.abs(trace.signedSweep) * 180 / Math.PI;
    const consistency = Math.abs(trace.signedSweep) / trace.totalSweep;
    if (trace.samples < config.circleMinSamples || sweep < config.circleSweepThreshold || consistency < 0.75) return null;
    const direction: MotionDirection = trace.signedSweep > 0 ? 'rotate-left' : 'rotate-right';
    circleTrace = null;
    if (timestamp - lastCircleAt < config.directionCooldown) return null;
    lastCircleAt = timestamp;
    return { direction, intensity: Math.hypot(x, y) };
  };
  return {
    orientation(data: OrientationData) {
      if (data.beta === null || data.gamma === null) { resetFace(); return; }
      // Screen normal projected onto world up; independent of heading and tilt calibration.
      const up = Math.cos(data.beta * Math.PI / 180) * Math.cos(data.gamma * Math.PI / 180);
      const face: ScreenFace = up > 0.7 ? 'front' : up < -0.7 ? 'back' : 'edge';
      if (face !== faceCandidate) { faceCandidate = face; faceSince = data.timestamp; }
      if (face !== screenFace && data.timestamp - faceSince >= 50) {
        screenFace = face; update({ screenFace });
        emit({ type: 'screen-face', source: 'orientation', timestamp: data.timestamp, intensity: Math.abs(up), screenFace });
      }
      if (!tiltBaseline) tiltBaseline = { beta: data.beta, gamma: data.gamma };
      const betaDelta = angleDelta(data.beta, tiltBaseline.beta);
      const gammaDelta = data.gamma - tiltBaseline.gamma;
      const intensity = Math.max(Math.abs(betaDelta), Math.abs(gammaDelta));
      clearTimeout(tiltTimer); tiltTimer = setTimeout(() => { resetFace(); tilting = null; tiltDirection = null; tiltBaseline = null; update({ tilting: null, tiltDirection: null }); }, config.staleAfter);
      const next = intensity >= config.tiltThreshold ? true : intensity <= config.tiltRelease ? false : tilting;
      if (next !== tilting) { tilting = next; update({ tilting }); if (tilting) emit({ type: 'tilt', source: 'orientation', timestamp: data.timestamp, intensity }); }
      if (intensity >= config.tiltThreshold) {
        const direction: TiltDirection = Math.abs(betaDelta) >= Math.abs(gammaDelta) ? (betaDelta > 0 ? 'forward' : 'backward') : (gammaDelta > 0 ? 'right' : 'left');
        if (direction !== tiltDirection) { tiltDirection = direction; update({ tiltDirection }); emit({ type: 'tilt-direction', source: 'orientation', timestamp: data.timestamp, intensity, tiltDirection: direction }); }
      } else if (intensity <= config.tiltRelease && tiltDirection !== null) { tiltDirection = null; update({ tiltDirection: null }); }
    },
    motion(data: MotionData) {
      const now = data.timestamp;
      const r = data.rotationRate;
      if (r.alpha !== null && r.beta !== null && r.gamma !== null) {
        const intensity = Math.hypot(r.alpha, r.beta, r.gamma);
        clearTimeout(rotationTimer); rotationTimer = setTimeout(() => { rotating = null; update({ rotating: null }); }, config.staleAfter);
        const next = intensity >= config.rotationThreshold ? true : intensity <= config.rotationRelease ? false : rotating;
        if (next !== rotating) { rotating = next; update({ rotating }); if (rotating) emit({ type: 'rotation', source: 'motion', timestamp: data.timestamp, intensity }); }
      }
      const x = data.acceleration.x; const y = data.acceleration.y;
      const circle = detectCircle(x, y, now);
      if (circle) reportDirection(circle.direction, circle.intensity, now);
      if (x !== null && y !== null && (!circleTrace || circleTrace.samples < 2)) {
        const axisIntensity = Math.max(Math.abs(x), Math.abs(y));
        if (axisIntensity < config.directionThreshold * 0.5 && now - lastDirectionAt >= config.directionCooldown) directionArmed = true;
        if (axisIntensity >= config.directionThreshold && directionArmed) {
          directionArmed = false;
          if (now - lastDirectionAt >= config.directionCooldown) reportDirection(Math.abs(x) >= Math.abs(y) ? (x > 0 ? 'left' : 'right') : (y > 0 ? 'down' : 'up'), axisIntensity, now);
        }
      }
      const v = complete(data.acceleration); if (!v) return;
      const intensity = Math.hypot(...v);
      clearTimeout(stale); stale = setTimeout(resetMotion, config.staleAfter);
      update({ movementIntensity: intensity });
      if (shaking === null) { shaking = false; update({ shaking }); }
      const next = intensity >= config.movementThreshold ? 'movement' : intensity <= config.stationaryThreshold ? 'stationary' : null;
      if (next !== candidate) { candidate = next; candidateSince = now; }
      if (next && now - candidateSince >= (next === 'movement' ? config.movementDuration : config.stationaryDuration) && moving !== (next === 'movement')) {
        moving = next === 'movement'; update({ moving, stationary: !moving });
        emit({ type: next, source: 'motion', timestamp: now, intensity });
      }
      if (intensity >= config.shakeThreshold) {
        if (peak && now - peak.time <= config.shakeWindow && v.reduce((sum, value, i) => sum + value * peak!.vector[i]!, 0) < 0 && now - lastShake >= config.shakeCooldown) {
          lastShake = now; shaking = true; update({ shaking }); clearTimeout(shakeTimer); shakeTimer = setTimeout(() => { shaking = false; update({ shaking }); }, Math.max(100, config.shakeCooldown)); emit({ type: 'shake', source: 'motion', timestamp: now, intensity }); peak = null;
        } else peak = { vector: v, time: now };
      }
    },
    reset,
  };
}
function complete(v: Vector3): number[] | null { return v.x !== null && v.y !== null && v.z !== null ? [v.x, v.y, v.z] : null; }
function angleDelta(value: number, baseline: number) { return ((value - baseline + 540) % 360) - 180; }
function angleDeltaRadians(value: number, baseline: number) { let delta = value - baseline; if (delta > Math.PI) delta -= Math.PI * 2; else if (delta < -Math.PI) delta += Math.PI * 2; return delta; }
