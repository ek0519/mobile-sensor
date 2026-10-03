import { detectors, detectorDefaults } from '../detectors';
import type { DetectorEvent, DetectorOptions, ScreenFace } from '../types';
import { extractMotionWindowFeatures, vectorMagnitude } from '../features';
import type { SensorRecord } from '../recording/types';
export type BehaviorName = 'pickup' | 'putdown' | 'flip' | 'handling' | 'walking';
export interface BehaviorEvent { type: BehaviorName; timestamp: number; confidence: number; duration?: number; metadata?: Record<string, unknown> }
export interface PickupOptions { minDuration: number; maxDuration: number; orientationThreshold: number; reducedMovementDuration: number }
export interface PutdownOptions { stationaryDuration: number; maxDuration: number; impactThreshold: number }
export interface WalkingOptions { windowMs: number; minFrequency: number; maxFrequency: number; minPeriodicity: number; minVariance: number; cooldown: number; evaluationInterval: number }
export interface BehaviorDetectorOptions {
  pickup?: Partial<PickupOptions>; putdown?: Partial<PutdownOptions>; walking?: Partial<WalkingOptions>;
  flip?: { maxDuration?: number }; handling?: { windowMs?: number; minEvidence?: number; evidenceInterval?: number }; detectors?: Partial<DetectorOptions>;
}
export function createBehaviorEngine(options: BehaviorDetectorOptions = {}) {
  const pickup = { minDuration:300, maxDuration:2500, orientationThreshold:20, reducedMovementDuration:150, ...options.pickup };
  const putdown = { stationaryDuration:700, maxDuration:4000, impactThreshold:3, ...options.putdown };
  const walking = { windowMs:3000, minFrequency:1, maxFrequency:3, minPeriodicity:0.65, minVariance:0.15, cooldown:2000, evaluationInterval:250, ...options.walking };
  const handling = { windowMs:1200, minEvidence:3, evidenceInterval:80, ...options.handling };
  const flipDuration = options.flip?.maxDuration ?? 2000;
  for (const value of [...Object.values(pickup), ...Object.values(putdown), ...Object.values(walking), ...Object.values(handling), flipDuration]) if (!Number.isFinite(value) || value < 0) throw new RangeError('Behavior options must be finite and non-negative');
  if (!walking.windowMs || walking.minFrequency > walking.maxFrequency || walking.minPeriodicity > 1 || pickup.minDuration > pickup.maxDuration || !Number.isInteger(handling.minEvidence) || handling.minEvidence < 1) throw new RangeError('Invalid behavior options');
  const handlers = new Map<BehaviorName, Set<(event: BehaviorEvent)=>void>>();
  const detectorHandlers = new Set<(event: DetectorEvent)=>void>();
  let records: SensorRecord[] = [], activity: number[] = [], handlingActive=false, stationary=false;
  let face: { value: ScreenFace; t: number } | null=null;
  let baseline: { beta: number; gamma: number } | null=null;
  let candidate: { start: number; fromStationary: boolean; oriented: boolean; impact: boolean; quiet: number | null } | null=null;
  let now=0, epoch=0, lastWalk=-Infinity, lastEvidence=-Infinity, lastEvaluation=-Infinity;
  function emit(type: BehaviorName, confidence: number, metadata?: Record<string,unknown>, duration?: number) {
    const event: BehaviorEvent={type,timestamp:epoch,confidence:Math.max(0,Math.min(1,confidence)),metadata,duration};
    for(const fn of [...(handlers.get(type) ?? [])]) fn(event);
  }
  function evidence() { if(now-lastEvidence >= handling.evidenceInterval) { activity.push(now); lastEvidence=now; } }
  const detector=detectors(options.detectors ?? {}, event=> {
    for(const fn of detectorHandlers) fn({...event,timestamp:epoch});
    if(event.type==='stationary') stationary=true;
    if(event.type==='movement') {
      if(!candidate) candidate={start:now,fromStationary:stationary,oriented:false,impact:false,quiet:null};
      stationary=false; evidence();
    }
    if(['rotation','tilt','tilt-direction'].includes(event.type)) { evidence(); if(candidate) candidate.oriented=true; }
    if(event.type==='screen-face' && event.screenFace && event.screenFace!=='edge') {
      if(face && face.value!==event.screenFace && now-face.t <= flipDuration) emit('flip',0.85,{from:face.value,to:event.screenFace});
      if(!face || face.value!==event.screenFace) { if(candidate) candidate.oriented=true; face={value:event.screenFace,t:now}; }
      else face.t=now;
    }
  },()=>{}, { timers:false });
  return {
    on(type: BehaviorName, fn: (event: BehaviorEvent)=>void) { let set=handlers.get(type); if(!set) {set=new Set();handlers.set(type,set);} set.add(fn); return ()=>{set.delete(fn);}; },
    onDetector(fn: (event: DetectorEvent)=>void) { detectorHandlers.add(fn); return ()=>{detectorHandlers.delete(fn);}; },
    processSensorRecord(record: SensorRecord) {
      if(record.t < now) throw new RangeError('Records must be processed in relative-time order');
      now=record.t; epoch=record.timestamp;
      activity=activity.filter(t=>now-t<=handling.windowMs);
      if(handlingActive && !activity.length) {handlingActive=false;emit('handling',0.7,{active:false});}
      if(candidate && now-candidate.start > Math.max(pickup.maxDuration,putdown.maxDuration)) candidate=null;
      if(record.sensor==='orientation') {
        const {beta,gamma}=record.data;
        if(beta!==null && gamma!==null) {
          if(baseline && candidate && Math.max(Math.abs(((beta-baseline.beta+540)%360)-180),Math.abs(gamma-baseline.gamma))>=pickup.orientationThreshold) candidate.oriented=true;
          if(!candidate) baseline={beta,gamma};
          const normal=Math.cos(beta*Math.PI/180)*Math.cos(gamma*Math.PI/180);
          if(face && ((normal>0.7 && face.value==='front') || (normal < -0.7 && face.value==='back'))) face.t=now;
        }
        detector.orientation({...record.data,timestamp:now});
      }
      if(record.sensor==='pointer' && record.data.phase!=='cancel') evidence();
      if(record.sensor==='motion') {
        detector.motion({...record.data,timestamp:now});
        const magnitude=vectorMagnitude(record.data.acceleration);
        if(magnitude!==null) {
          if(magnitude>=(options.detectors?.movementThreshold ?? detectorDefaults.movementThreshold)) evidence();
          if(candidate) {
            if(candidate.oriented && magnitude>=putdown.impactThreshold) candidate.impact=true;
            if(magnitude<=(options.detectors?.stationaryThreshold ?? detectorDefaults.stationaryThreshold)) candidate.quiet ??=now; else candidate.quiet=null;
            const duration=now-candidate.start;
            if(candidate.fromStationary && candidate.oriented && candidate.quiet!==null && duration>=pickup.minDuration && duration<=pickup.maxDuration && now-candidate.quiet>=pickup.reducedMovementDuration) {emit('pickup',0.8,undefined,duration);candidate=null;}
            else if(candidate.oriented && candidate.impact && candidate.quiet!==null && now-candidate.quiet>=putdown.stationaryDuration && duration<=putdown.maxDuration) {emit('putdown',0.8,undefined,duration);candidate=null;}
          }
        }
        records.push(record); records=records.filter(r=>now-r.t<=walking.windowMs);
        if(now-lastWalk>=walking.cooldown && now-lastEvaluation>=walking.evaluationInterval) {
          lastEvaluation=now;
          const f=extractMotionWindowFeatures(records,{windowMs:walking.windowMs});
          const frequency=f.dominantFrequency;
          const expectedPeaks=frequency===null ? 0 : frequency*(f.endedAt-f.startedAt)/1000;
          const consistency=expectedPeaks ? Math.max(0,1-Math.abs((f.acceleration.peakCount ?? 0)-expectedPeaks)/expectedPeaks) : 0;
          if(f.endedAt-f.startedAt>=2000 && f.sampleCount>=20 && frequency!==null && frequency>=walking.minFrequency && frequency<=walking.maxFrequency && (f.periodicity ?? 0)>=walking.minPeriodicity && (f.acceleration.variance ?? 0)>=walking.minVariance && consistency>=0.6) {lastWalk=now;emit('walking',((f.periodicity ?? 0)+consistency)/2,{features:f});}
        }
      }
      if(!handlingActive && activity.length>=handling.minEvidence) {handlingActive=true;emit('handling',0.7,{active:true});}
    },
    reset() {detector.reset();records=[];activity=[];handlingActive=stationary=false;face=baseline=candidate=null;now=epoch=0;lastWalk=lastEvidence=lastEvaluation=-Infinity;},
  };
}
