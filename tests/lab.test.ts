import { it, expect, vi, afterEach } from 'vitest';
import { createSessionUploader } from '../apps/lab/src/lib/api';
import { apiBase } from '../apps/lab/src/lib/config';
import { parseRecording } from '../apps/lab/src/lib/session';
import type { RecordingSessionMetadata, SensorRecord } from '../packages/core/src';
const metadata:RecordingSessionMetadata={schemaVersion:1,id:'local',label:'pickup',startedAt:100,includeLocation:false,device:{userAgent:'test',platform:null,language:null,screen:{width:1,height:1,devicePixelRatio:1}},capabilities:{motion:true,orientation:true,location:false,pointer:true}};
const record:SensorRecord={sensor:'orientation',seq:0,t:0,timestamp:100,data:{timestamp:100,alpha:0,beta:0,gamma:0,absolute:false}};
afterEach(()=>vi.useRealTimers());
it('blocks HTTPS mixed content',()=>{expect(()=>apiBase('http://example.com','https:')).toThrow();expect(apiBase('https://example.com/')).toBe('https://example.com');});
it('batches records, flushes on interval and finishes after records',async()=>{
 vi.useFakeTimers();const requests:{url:string;body:unknown}[]=[];
 const fetcher=vi.fn(async(url:unknown,options?:RequestInit)=>{requests.push({url:String(url),body:JSON.parse(String(options?.body))});return new Response(String(url).endsWith('/v1/sessions') ? '{"id":"server"}' : '',{status:200});}) as unknown as typeof fetch;
 const uploader=createSessionUploader('https://example.com',metadata,{fetch:fetcher});await uploader.start();uploader.enqueue(Array.from({length:201},(_,i)=>({...record,seq:i})));await uploader.flush();
 expect((requests[1]?.body as {records:unknown[]}).records).toHaveLength(200);expect((requests[2]?.body as {records:unknown[]}).records).toHaveLength(1);
 uploader.enqueue([record]);await vi.advanceTimersByTimeAsync(1000);expect(uploader.getPendingRecords()).toHaveLength(0);await uploader.finish(200);expect(requests.at(-1)?.url).toContain('/finish');expect(vi.getTimerCount()).toBe(0);
});
it('retains failed batches after three attempts and supports retry without recreating session',async()=>{
 vi.useFakeTimers();let fail=true;const fetcher=vi.fn(async(url:unknown)=>new Response(String(url).endsWith('/v1/sessions') ? '{"id":"server"}' : '',{status:String(url).endsWith('/records') && fail ? 503 : 200})) as unknown as typeof fetch;
 const uploader=createSessionUploader('https://example.com',metadata,{fetch:fetcher});await uploader.start();uploader.enqueue([record]);const p=uploader.finish(200);const assertion=expect(p).rejects.toThrow('503');await vi.runAllTimersAsync();await assertion;expect(uploader.getPendingRecords()).toHaveLength(1);expect(fetcher).toHaveBeenCalledTimes(4);fail=false;await uploader.finish(200);expect(uploader.getPendingRecords()).toHaveLength(0);expect(fetcher).toHaveBeenCalledTimes(6);
});
it('validates imported data and rejects location without opt-in',()=>{expect(parseRecording(JSON.stringify({metadata,records:[record]})).records).toHaveLength(1);expect(()=>parseRecording(JSON.stringify({metadata,records:[{...record,sensor:'location'}]}))).toThrow();expect(()=>parseRecording(JSON.stringify({metadata,records:[record,record]}))).toThrow();});
