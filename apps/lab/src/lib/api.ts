import type { RecordingSessionMetadata, SensorRecord } from '@mobile-sensor/core';
import { apiBase } from './config';
export interface UploadOptions { batchSize?: number; flushInterval?: number; fetch?: typeof fetch; onStatus?: (status: string)=>void }
export function createSessionUploader(base: string | undefined, metadata: RecordingSessionMetadata, options: UploadOptions = {}) {
  const size=options.batchSize ?? 200, interval=options.flushInterval ?? 1000;
  if (!Number.isInteger(size) || size<1 || !Number.isFinite(interval) || interval<=0) throw new RangeError('Invalid batch options');
  let id: string | null=null, pending: SensorRecord[]=[], timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | null=null, error: unknown=null, started=false;
  const send=options.fetch ?? fetch;
  async function request(path: string, body: unknown): Promise<unknown> {
    const url=apiBase(base);
    for(let attempt=1;attempt<=3;attempt++) {
      try {
        const response=await send(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        if(!response.ok) {
          const failure=new Error(`Upload failed: HTTP ${response.status}`);
          if(response.status!==408 && response.status!==429 && response.status<500) throw Object.assign(failure,{permanent:true});
          throw failure;
        }
        if(path==='/v1/sessions') return await response.json();
        return undefined;
      } catch(e) {
        if(attempt===3 || (e as {permanent?:boolean}).permanent) throw e;
        await new Promise(resolve=>setTimeout(resolve,250*attempt));
      }
    }
  }
  async function initialize() {
    if(id) return;
    const {id:localId,...body}=metadata; void localId;
    const result=await request('/v1/sessions',body) as {id?:unknown};
    if(typeof result?.id!=='string' || !result.id) throw new Error('Server did not return a session id');
    id=result.id;
  }
  async function drain() {
    await initialize();
    while(pending.length) {
      const batch=pending.slice(0,size);
      await request(`/v1/sessions/${encodeURIComponent(id!)}/records`,{records:batch});
      pending.splice(0,batch.length);
    }
    options.onStatus?.('Saved batches');
  }
  function flush(): Promise<void> {
    if(running) return running;
    running=drain().catch(e=>{error=e;options.onStatus?.(String(e));throw e;}).finally(()=>{running=null;});
    return running;
  }
  return {
    async start() { await initialize(); error=null; started=true; timer ??=setInterval(()=>{if(pending.length && !error) void flush().catch(()=>{});},interval); },
    enqueue(records: readonly SensorRecord[]) {
      if(records.some(r=>r.sensor==='location') && !metadata.includeLocation) throw new Error('Location recording was not enabled');
      pending.push(...structuredClone(records));
      if(started && pending.length>=size && !error) void flush().catch(()=>{});
    },
    flush,
    async finish(endedAt: number) {
      if(timer!==undefined) clearInterval(timer); timer=undefined; error=null;
      // A running flush may have taken its last snapshot before new records were queued.
      await flush(); if(pending.length) await flush();
      await request(`/v1/sessions/${encodeURIComponent(id!)}/finish`,{endedAt});
      options.onStatus?.('Upload complete');
    },
    dispose() {if(timer!==undefined) clearInterval(timer);timer=undefined;},
    getPendingRecords: ()=>structuredClone(pending),
  };
}
