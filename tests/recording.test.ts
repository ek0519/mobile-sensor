import { describe, it, expect, vi, afterEach } from 'vitest';
import { channel } from '../packages/core/src/channel';
import { createSensorRecorder, replaySensorRecording, extractMotionWindowFeatures, vectorMagnitude, createBehaviorEngine } from '../packages/core/src';
import type { MotionData, OrientationData, LocationData, PointerData, SensorRecord, BehaviorEvent } from '../packages/core/src';
function motion(t: number, x=0): SensorRecord {return {sensor:'motion',seq:t,t,timestamp:10000+t,data:{timestamp:10000+t,acceleration:{x,y:0,z:0},accelerationIncludingGravity:{x:0,y:0,z:9.8},rotationRate:{alpha:0,beta:0,gamma:0},interval:50}};}
function orientation(t: number, beta: number): SensorRecord {return {sensor:'orientation',seq:t,t,timestamp:10000+t,data:{timestamp:10000+t,alpha:0,beta,gamma:0,absolute:false}};}
function harness() {
 const motion=channel<MotionData | null>(null),orientation=channel<OrientationData | null>(null),location=channel<LocationData | null>(null),pointer=channel<PointerData | null>(null);
 return { channels:{motion,orientation,location,pointer}, sensors:{motion:motion.api,orientation:orientation.api,location:location.api,pointer:pointer.api} };
}
afterEach(()=>vi.useRealTimers());
describe('SensorRecorder',()=>{
 it('records all raw channels, sequences, relative arrival time, copies values and avoids duplicate subscriptions',()=>{
  vi.useFakeTimers();vi.setSystemTime(10000);const h=harness();const r=createSensorRecorder(h.sensors);r.start();r.start();
  vi.advanceTimersByTime(25);const sample=(motion(0,2) as Extract<SensorRecord,{sensor:'motion'}>).data;h.channels.motion.publish(sample);sample.acceleration.x=99;
  vi.advanceTimersByTime(25);h.channels.orientation.publish((orientation(0,45) as Extract<SensorRecord,{sensor:'orientation'}>).data);
  h.channels.location.publish({timestamp:10000,latitude:1,longitude:2,accuracy:3,altitude:null,altitudeAccuracy:null,speed:null,heading:null});
  const result=r.stop();expect(result.records.map(s=>[s.seq,s.t,s.timestamp])).toEqual([[0,25,10000],[1,50,10000]]);expect(result.records[0]?.data).toMatchObject({acceleration:{x:2}});
  h.channels.motion.publish(sample);expect(r.getRecords()).toHaveLength(2);r.clear();expect(r.getRecords()).toHaveLength(0);
 });
 it('location requires explicit opt-in and record limit detaches all channels',()=>{
  const h=harness();const r=createSensorRecorder(h.sensors,{includeLocation:true,maxRecords:1});r.start();h.channels.location.publish({timestamp:1,latitude:1,longitude:2,accuracy:3,altitude:null,altitudeAccuracy:null,speed:null,heading:null});
  expect(r.isRecording()).toBe(false);expect(r.stop().records[0]?.sensor).toBe('location');h.channels.motion.publish((motion(0) as Extract<SensorRecord,{sensor:'motion'}>).data);expect(r.getRecords()).toHaveLength(1);expect(()=>createSensorRecorder(h.sensors,{maxRecords:0})).toThrow();
 });
});
describe('Replay',()=>{
 it('instant replay preserves record order deterministically without timers',async()=>{
  vi.useFakeTimers();const samples=[motion(200),orientation(300,90),motion(300)];const result:SensorRecord[]=[];
  await replaySensorRecording({records:samples},{speed:0,onRecord:r=>{result.push(r);}});expect(result).toEqual(samples);expect(vi.getTimerCount()).toBe(0);
 });
 it.each([0.5,1,2])('honors relative timing at speed %s',async speed=>{
  vi.useFakeTimers();const result:number[]=[];const replay=replaySensorRecording({records:[motion(100),motion(300)]},{speed,onRecord:r=>{result.push(r.t);}});
  await vi.advanceTimersByTimeAsync(100/speed-1);expect(result).toEqual([]);await vi.advanceTimersByTimeAsync(1);expect(result).toEqual([100]);await vi.advanceTimersByTimeAsync(200/speed);await replay;expect(result).toEqual([100,300]);
 });
 it('cancellation removes pending timers',async()=>{vi.useFakeTimers();const c=new AbortController();const p=replaySensorRecording({records:[motion(1000)]},{signal:c.signal,onRecord:()=>{}});const assertion=expect(p).rejects.toBeDefined();c.abort();await assertion;expect(vi.getTimerCount()).toBe(0);});
});
describe('Features and behaviors',()=>{
 it('preserves nulls and extracts known statistics',()=>{expect(vectorMagnitude({x:3,y:4,z:0})).toBe(5);expect(vectorMagnitude({x:null,y:4,z:0})).toBeNull();const f=extractMotionWindowFeatures([motion(0,1),motion(50,3)]);expect(f.acceleration.mean).toBe(2);expect(f.acceleration.variance).toBe(1);expect(f.acceleration.rms).toBe(Math.sqrt(5));expect(extractMotionWindowFeatures([]).acceleration.mean).toBeNull();});
 function run(records:SensorRecord[]) {const engine=createBehaviorEngine();const events:BehaviorEvent[]=[];for(const type of ['flip','pickup','putdown','handling','walking'] as const) engine.on(type,e=>events.push(e));for(const r of records) engine.processSensorRecord(r);engine.reset();return events;}
 it('flip crosses edge but expires after configured window',()=>{expect(run([orientation(0,0),orientation(60,0),orientation(100,90),orientation(160,90),orientation(300,180),orientation(360,180)]).find(e=>e.type==='flip')?.metadata).toEqual({from:'front',to:'back'});expect(run([orientation(0,0),orientation(60,0),orientation(3000,180),orientation(3060,180)]).filter(e=>e.type==='flip')).toHaveLength(0);});
 it('flip uses recent face evidence after long stationary periods',()=>{expect(run([orientation(0,0),orientation(60,0),orientation(10000,0),orientation(10100,180),orientation(10160,180)]).some(e=>e.type==='flip')).toBe(true);});
 it('pickup requires stationary baseline, motion, orientation change and reduced motion',()=>{const records=[orientation(0,0),motion(0),motion(800),motion(900,2),motion(1100,2),orientation(1200,45),motion(1300),motion(1500)];expect(run(records).some(e=>e.type==='pickup')).toBe(true);expect(run(records.filter(r=>r.sensor!=='orientation')).some(e=>e.type==='pickup')).toBe(false);});
 it('putdown requires impact after orientation and sustained stationary confirmation',()=>{const records=[orientation(0,0),motion(0,2),motion(200,2),orientation(300,60),motion(400,5),motion(500),motion(900),motion(1300)];expect(run(records).some(e=>e.type==='putdown')).toBe(true);expect(run(records.slice(0,-1)).some(e=>e.type==='putdown')).toBe(false);});
 it('handling emits active and inactive states on recorded-time timeout',()=>{const events=run([motion(0,2),motion(100,2),motion(200,2),motion(1600)]).filter(e=>e.type==='handling');expect(events.map(e=>e.metadata?.active)).toEqual([true,false]);});
 it('walking uses periodic windows and rejects irregular signals',()=>{const periodic=Array.from({length:81},(_,i)=>motion(i*50,2+Math.sin(2*Math.PI*2*i*0.05)));expect(run(periodic).some(e=>e.type==='walking')).toBe(true);let seed=19;const noisy=Array.from({length:81},(_,i)=>{seed=(seed*16807)%2147483647;return motion(i*50,seed/2147483647*4);});expect(run(noisy).some(e=>e.type==='walking')).toBe(false);expect(run([motion(0,10)]).some(e=>e.type==='walking')).toBe(false);});
 it('behavior results are identical at instant and timed replay speeds',async()=>{vi.useFakeTimers();const records=[motion(0,2),motion(100,2),motion(200,2),motion(1600)];const engine=createBehaviorEngine();const events:BehaviorEvent[]=[];engine.on('handling',e=>events.push(e));await replaySensorRecording({records},{speed:0,onRecord:r=>engine.processSensorRecord(r)});const first=structuredClone(events);engine.reset();events.length=0;const p=replaySensorRecording({records},{speed:0.5,onRecord:r=>engine.processSensorRecord(r)});await vi.runAllTimersAsync();await p;expect(events).toEqual(first);expect(vi.getTimerCount()).toBe(0);engine.reset();});
});
