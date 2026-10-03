import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMobileSensor } from '@mobile-sensor/core';
import type { MobileSensorOutput } from '@mobile-sensor/core';
import { dispatch, environment } from './environment';
const motion = { acceleration: { x: 0, y: 0, z: 0 }, accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 }, rotationRate: { alpha: 0, beta: 0, gamma: 0 }, interval: 50 };
afterEach(() => vi.useRealTimers());
describe('unified mobile sensor', () => {
  it('automatically combines raw, gesture and behavior output with correlated ids and sequences', async () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const env = environment(), sensor = createMobileSensor({ environment: env });
    const outputs: MobileSensorOutput[] = [];
    sensor.onData(output => outputs.push(output));
    dispatch(env.window, 'devicemotion', motion);
    expect(outputs).toEqual([]);
    await sensor.start({ sessionId: 'session-1' });
    const emit = (t: number, type: string, data: object) => { vi.setSystemTime(10000 + t); dispatch(env.window, type, data); };
    emit(0, 'deviceorientation', { alpha: 0, beta: 0, gamma: 0, absolute: false });
    emit(0, 'devicemotion', motion);
    emit(800, 'devicemotion', motion);
    emit(900, 'devicemotion', { ...motion, acceleration: { x: 2, y: 0, z: 0 } });
    emit(1100, 'devicemotion', { ...motion, acceleration: { x: 2, y: 0, z: 0 } });
    emit(1200, 'deviceorientation', { alpha: 0, beta: 45, gamma: 0, absolute: false });
    emit(1300, 'devicemotion', motion);
    emit(1500, 'devicemotion', motion);
    expect(outputs.map(o => o.seq)).toEqual(outputs.map((_, i) => i));
    expect(outputs.every(o => o.schemaVersion === 1 && o.sessionId === 'session-1')).toBe(true);
    const pickup = outputs.find(o => o.kind === 'behavior' && o.data.type === 'pickup');
    expect(pickup).toMatchObject({ kind: 'behavior', t: 1500, timestamp: 11500, recordSeq: 7, data: { type: 'pickup' } });
    const trigger = outputs.find(o => o.kind === 'raw' && o.recordSeq === pickup?.recordSeq);
    expect(trigger?.seq).toBeLessThan(pickup!.seq);
    expect(outputs.some(o => o.kind === 'gesture' && o.data.type === 'stationary')).toBe(true);
    sensor.destroy(); expect(vi.getTimerCount()).toBe(0);
  });
  it('includes pointer press gestures in the same stream after their raw sample', async () => {
    const env = environment(), sensor = createMobileSensor({ environment: env });
    const outputs: MobileSensorOutput[] = []; sensor.onData(o => outputs.push(o));
    await sensor.start(); dispatch(env.window, 'pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20, pressure: 0.5 });
    expect(outputs.map(o => o.kind)).toEqual(['raw', 'gesture']);
    expect(outputs[1]).toMatchObject({ recordSeq: 0, data: { type: 'left-press' } }); sensor.destroy();
  });
  it('does not duplicate subscriptions and supports unsubscribe, pause, restart and destroy', async () => {
    const env = environment(), sensor = createMobileSensor({ environment: env });
    const outputs: MobileSensorOutput[] = []; const unsubscribe = sensor.onData(o => outputs.push(o));
    await sensor.start({ sessionId: 'one' }); await sensor.start();
    dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(1);
    sensor.pause(); dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(1);
    sensor.resume(); dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(2);
    sensor.stop(); dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(2);
    await sensor.start({ sessionId: 'two' }); dispatch(env.window, 'devicemotion', motion);
    expect(outputs[2]).toMatchObject({ sessionId: 'two', seq: 0, recordSeq: 0 });
    unsubscribe(); dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(3);
    sensor.destroy(); await sensor.start(); dispatch(env.window, 'devicemotion', motion); expect(outputs).toHaveLength(3);
  });
  it('keeps subscriber mutations away from the engine and other subscribers', async () => {
    const env = environment(), sensor = createMobileSensor({ environment: env });
    sensor.onData(o => { if (o.kind === 'raw' && o.data.sensor === 'motion') o.data.data.acceleration.x = 999; });
    const outputs: MobileSensorOutput[] = []; sensor.onData(o => outputs.push(o));
    await sensor.start(); dispatch(env.window, 'devicemotion', motion);
    expect(outputs[0]).toMatchObject({ data: { data: { acceleration: { x: 0 } } } }); sensor.destroy();
  });
  it('requires location opt-in and preserves location source timestamps separately from arrival time', async () => {
    vi.useFakeTimers(); vi.setSystemTime(10000); const env = environment();
    let publish: PositionCallback | undefined;
    const watchPosition = vi.fn((success: PositionCallback) => { publish = success; return 1; });
    env.navigator.geolocation = { watchPosition, clearWatch: vi.fn() };
    const sensor = createMobileSensor({ environment: env }); const outputs: MobileSensorOutput[] = []; sensor.onData(o => outputs.push(o));
    await sensor.start(); expect(watchPosition).not.toHaveBeenCalled();
    await sensor.start({ location: true }); vi.setSystemTime(10200);
    publish!({ timestamp: 9500, coords: { latitude: 1, longitude: 2, accuracy: 3, altitude: null, altitudeAccuracy: null, speed: null, heading: null } } as GeolocationPosition);
    expect(outputs[0]).toMatchObject({ kind: 'raw', t: 200, timestamp: 9500, data: { sensor: 'location' } });
    await sensor.start({ location: false }); expect(env.navigator.geolocation.clearWatch).toHaveBeenCalledWith(1); sensor.destroy();
  });
  it('is safe without browser APIs and never requests permission until explicitly called', async () => {
    const sensor = createMobileSensor({ environment: null }); const listener = vi.fn(); sensor.onData(listener); await sensor.start(); sensor.destroy(); expect(listener).not.toHaveBeenCalled();
    const env = environment(); const requestPermission = vi.fn(async () => 'granted'); env.window.DeviceMotionEvent = { requestPermission };
    const live = createMobileSensor({ environment: env }); await live.start(); expect(requestPermission).not.toHaveBeenCalled();
    const permission = live.requestPermission(); expect(requestPermission).toHaveBeenCalledTimes(1); await permission; live.destroy();
  });
  it('does not emit stale outputs into a session restarted by a callback', async () => {
    vi.useFakeTimers(); vi.setSystemTime(10000); const env = environment(), sensor = createMobileSensor({ environment: env });
    const outputs: MobileSensorOutput[] = []; let restart = false;
    sensor.onData(o => { outputs.push(o); if (restart && o.kind === 'raw') { restart = false; sensor.stop(); void sensor.start({ sessionId: 'new' }); } });
    await sensor.start({ sessionId: 'old' }); dispatch(env.window, 'devicemotion', motion); vi.setSystemTime(10800); restart = true; dispatch(env.window, 'devicemotion', motion);
    expect(outputs.filter(o => o.kind === 'gesture')).toHaveLength(0); dispatch(env.window, 'devicemotion', motion); expect(outputs.at(-1)).toMatchObject({ sessionId: 'new', seq: 0 }); sensor.destroy();
  });
});
