import type { RecordingSessionMetadata, SensorRecording, SensorRecord } from '@mobile-sensor/core';
export interface LabSession extends SensorRecording { metadata: RecordingSessionMetadata }
export function downloadSession(session: LabSession, format: 'json' | 'ndjson') {
  const body=format==='json' ? JSON.stringify(session,null,2) : session.records.map(r=>JSON.stringify(r)).join('\n');
  const url=URL.createObjectURL(new Blob([body],{type:format==='json' ? 'application/json' : 'application/x-ndjson'}));
  const a=document.createElement('a');a.href=url;a.download=`sensor-${session.metadata.id}.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function parseRecording(text: string): LabSession {
  const value=JSON.parse(text) as LabSession;
  if(!value || !Array.isArray(value.records) || value.records.length>100_000 || value.metadata?.schemaVersion!==1 || typeof value.metadata.includeLocation!=='boolean') throw new Error('Expected recording schema version 1 with metadata and up to 100,000 records');
  let previousT=-1, previousSeq=-1;
  const finite=(v: unknown): v is number=>typeof v==='number' && Number.isFinite(v);
  const nullable=(v: unknown)=>v===null || finite(v);
  const vector=(v: unknown)=>!!v && typeof v==='object' && ['x','y','z'].every(k=>nullable((v as Record<string,unknown>)[k]));
  for(const r of value.records as SensorRecord[]) {
    if(!r || !['motion','orientation','pointer','location'].includes(r.sensor) || !finite(r.t) || r.t<0 || r.t<previousT || !Number.isInteger(r.seq) || r.seq<=previousSeq || !finite(r.timestamp) || !r.data || !finite(r.data.timestamp)) throw new Error('Invalid record order or data');
    if(r.sensor==='location' && (!value.metadata.includeLocation || ![r.data.latitude,r.data.longitude,r.data.accuracy].every(finite))) throw new Error('Invalid or unapproved location data');
    if(r.sensor==='motion' && (!vector(r.data.acceleration) || !vector(r.data.accelerationIncludingGravity) || !r.data.rotationRate || ![r.data.rotationRate.alpha,r.data.rotationRate.beta,r.data.rotationRate.gamma,r.data.interval].every(nullable))) throw new Error('Invalid motion sample');
    if(r.sensor==='orientation' && (![r.data.alpha,r.data.beta,r.data.gamma].every(nullable) || typeof r.data.absolute!=='boolean')) throw new Error('Invalid orientation sample');
    if(r.sensor==='pointer' && (!['down','move','up','cancel'].includes(r.data.phase) || ![r.data.x,r.data.y,r.data.pressure].every(nullable) || !finite(r.data.pointerId) || typeof r.data.pointerType!=='string')) throw new Error('Invalid pointer sample');
    previousT=r.t;previousSeq=r.seq;
  }
  value.startedAt=value.startedAt ?? value.metadata.startedAt;
  value.endedAt=value.endedAt ?? value.startedAt+(value.records.at(-1)?.t ?? 0);
  if(!finite(value.startedAt) || !finite(value.endedAt) || value.endedAt<value.startedAt) throw new Error('Invalid session timestamps');
  return value;
}
