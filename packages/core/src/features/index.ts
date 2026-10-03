import type { Vector3 } from '../types';
import type { SensorRecord } from '../recording/types';
export function vectorMagnitude(vector: Vector3): number | null {
  const { x, y, z } = vector;
  return x !== null && y !== null && z !== null && [x,y,z].every(Number.isFinite) ? Math.hypot(x,y,z) : null;
}
export function statistics(values: number[]) {
  if (!values.length) return { mean: null, min: null, max: null, variance: null, standardDeviation: null, rms: null };
  const mean = values.reduce((a,b) => a+b,0)/values.length;
  const variance = values.reduce((a,b) => a+(b-mean)**2,0)/values.length;
  return { mean, min: values.reduce((a,b)=>Math.min(a,b),Infinity), max: values.reduce((a,b)=>Math.max(a,b),-Infinity), variance, standardDeviation: Math.sqrt(variance), rms: Math.sqrt(values.reduce((a,b)=>a+b*b,0)/values.length) };
}
export interface MotionWindowFeatures {
  startedAt: number; endedAt: number; sampleCount: number;
  acceleration: ReturnType<typeof statistics> & { peakCount: number | null };
  rotation: { mean: number | null; max: number | null; variance: number | null };
  dominantFrequency: number | null; periodicity: number | null;
}
export interface MotionWindowOptions { windowMs?: number; endedAt?: number }
export function extractMotionWindowFeatures(records: readonly SensorRecord[], options: MotionWindowOptions = {}): MotionWindowFeatures {
  const windowMs = options.windowMs ?? 2000;
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive');
  const end = options.endedAt ?? records.at(-1)?.t ?? 0;
  const motion = records.filter(r => r.sensor === 'motion' && r.t >= end-windowMs && r.t <= end);
  const samples: { t: number; v: number }[] = [], rotation: number[] = [];
  for (const r of motion) if (r.sensor === 'motion') {
    const v = vectorMagnitude(r.data.acceleration); if (v !== null) samples.push({ t:r.t, v });
    const rate = r.data.rotationRate;
    const rot = vectorMagnitude({ x:rate.alpha, y:rate.beta, z:rate.gamma }); if (rot !== null) rotation.push(rot);
  }
  const values = samples.map(s=>s.v), stats = statistics(values), rot = statistics(rotation);
  let peaks = 0;
  for (let i=1;i<values.length-1;i++) if (values[i]! > values[i-1]! && values[i]! >= values[i+1]! && values[i]! > (stats.mean ?? 0)) peaks++;
  let frequency: number | null = null, periodicity: number | null = null;
  const duration = (samples.at(-1)?.t ?? 0)-(samples[0]?.t ?? 0);
  if (samples.length >= 16 && duration >= 1500 && (stats.variance ?? 0) > 1e-8) {
    // Least-squares sinusoidal projection on actual sample times, avoiding a uniform-rate assumption.
    let best = 0;
    for (let f=0.5; f<=5; f+=0.05) {
      let cc=0, ss=0, cs=0, yc=0, ys=0;
      for (const sample of samples) {
        const phase=2*Math.PI*f*(sample.t-samples[0]!.t)/1000, c=Math.cos(phase), s=Math.sin(phase), y=sample.v-stats.mean!;
        cc+=c*c; ss+=s*s; cs+=c*s; yc+=y*c; ys+=y*s;
      }
      const det=cc*ss-cs*cs;
      const score=det>1e-8 ? (ss*yc*yc-2*cs*yc*ys+cc*ys*ys)/det/(stats.variance!*samples.length) : 0;
      if(score>best) { best=score; frequency=f; }
    }
    periodicity=Math.min(1,Math.max(0,best));
  }
  return { startedAt: motion[0]?.t ?? end, endedAt:end, sampleCount:motion.length, acceleration:{...stats,peakCount:values.length ? peaks : null}, rotation:{mean:rot.mean,max:rot.max,variance:rot.variance}, dominantFrequency:frequency, periodicity };
}
