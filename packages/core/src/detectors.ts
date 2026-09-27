import type { MotionData, DetectorEvent, DetectorOptions, Vector3, DeviceState, OrientationData } from './types';
export const detectorDefaults: DetectorOptions = { shakeThreshold: 12, shakeWindow: 500, shakeCooldown: 1000, movementThreshold: 1.5, stationaryThreshold: 0.8, movementDuration: 150, stationaryDuration: 800, staleAfter: 1000, tiltThreshold: 20, tiltRelease: 15, rotationThreshold: 30, rotationRelease: 20 };
export function detectors(options: Partial<DetectorOptions>, emit: (event: DetectorEvent) => void, update: (patch: Partial<DeviceState>) => void) {
  const config = { ...detectorDefaults, ...options };
  const nonNegative = ['shakeThreshold', 'shakeWindow', 'shakeCooldown', 'movementThreshold', 'stationaryThreshold', 'movementDuration', 'stationaryDuration', 'staleAfter', 'tiltThreshold', 'tiltRelease', 'rotationThreshold', 'rotationRelease'] as const;
  if (nonNegative.some(key => !Number.isFinite(config[key]) || config[key] < 0) || config.staleAfter === 0 || config.movementThreshold <= config.stationaryThreshold || config.tiltRelease > config.tiltThreshold || config.rotationRelease > config.rotationThreshold) {
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
  let tiltTimer: ReturnType<typeof setTimeout> | undefined;
  let rotationTimer: ReturnType<typeof setTimeout> | undefined;
  const resetMotion = () => { clearTimeout(stale); stale = undefined; peak = null; lastShake = -Infinity; candidate = null; moving = null; update({ moving: null, stationary: null, shaking: null, movementIntensity: null }); };
  const reset = () => { resetMotion(); clearTimeout(tiltTimer); clearTimeout(rotationTimer); tilting = rotating = null; update({ tilting: null, rotating: null }); };
  return {
    orientation(data: OrientationData) {
      if (data.beta === null || data.gamma === null) return;
      const intensity = Math.max(Math.abs(data.beta), Math.abs(data.gamma));
      clearTimeout(tiltTimer); tiltTimer = setTimeout(() => { tilting = null; update({ tilting: null }); }, config.staleAfter);
      const next = intensity >= config.tiltThreshold ? true : intensity <= config.tiltRelease ? false : tilting;
      if (next !== tilting) { tilting = next; update({ tilting }); if (tilting) emit({ type: 'tilt', source: 'orientation', timestamp: data.timestamp, intensity }); }
    },
    motion(data: MotionData) {
      const r = data.rotationRate;
      if (r.alpha !== null && r.beta !== null && r.gamma !== null) {
        const intensity = Math.hypot(r.alpha, r.beta, r.gamma);
        clearTimeout(rotationTimer); rotationTimer = setTimeout(() => { rotating = null; update({ rotating: null }); }, config.staleAfter);
        const next = intensity >= config.rotationThreshold ? true : intensity <= config.rotationRelease ? false : rotating;
        if (next !== rotating) { rotating = next; update({ rotating }); if (rotating) emit({ type: 'rotation', source: 'motion', timestamp: data.timestamp, intensity }); }
      }
      const v = complete(data.acceleration); if (!v) return;
      const intensity = Math.hypot(...v); const now = data.timestamp;
      clearTimeout(stale); stale = setTimeout(resetMotion, config.staleAfter);
      update({ movementIntensity: intensity, shaking: false });
      const next = intensity >= config.movementThreshold ? 'movement' : intensity <= config.stationaryThreshold ? 'stationary' : null;
      if (next !== candidate) { candidate = next; candidateSince = now; }
      if (next && now - candidateSince >= (next === 'movement' ? config.movementDuration : config.stationaryDuration) && moving !== (next === 'movement')) {
        moving = next === 'movement'; update({ moving, stationary: !moving });
        emit({ type: next, source: 'motion', timestamp: now, intensity });
      }
      if (intensity >= config.shakeThreshold) {
        if (peak && now - peak.time <= config.shakeWindow && v.reduce((sum, value, i) => sum + value * peak!.vector[i]!, 0) < 0 && now - lastShake >= config.shakeCooldown) {
          lastShake = now; update({ shaking: true }); emit({ type: 'shake', source: 'motion', timestamp: now, intensity }); peak = null;
        } else peak = { vector: v, time: now };
      }
    },
    reset,
  };
}
function complete(v: Vector3): number[] | null { return v.x !== null && v.y !== null && v.z !== null ? [v.x, v.y, v.z] : null; }
