import { describe, expect, it, vi, afterEach } from 'vitest';
import { environment, dispatch } from './environment';
import { createSensors } from '@mobile-sensor/core';

afterEach(() => vi.useRealTimers());
describe('sensor channels', () => {
  it('starts with unknown data and independent stable snapshots', () => {
    const a = createSensors();
    const b = createSensors();
    expect(a.motion.getSnapshot()).toBeNull();
    expect(a.motion.getSnapshot()).toBe(a.motion.getSnapshot());
    expect(a.device.getSnapshot().moving).toBeNull();
    expect(a).not.toBe(b);
    a.destroy(); b.destroy();
  });
});

it('normalizes motion through the public channel and unsubscribes without stopping other consumers', async () => {
  const env = environment();
  const sensors = createSensors({ environment: env });
  const received = vi.fn(); const other = vi.fn();
  const unsubscribe = sensors.motion.subscribe(received);
  sensors.motion.subscribe(other);
  await sensors.start();
  dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: null, z: 0 }, interval: 16 });
  expect(sensors.motion.getSnapshot()).toMatchObject({ acceleration: { x: 2, y: null, z: 0 }, rotationRate: { alpha: null, beta: null, gamma: null }, interval: 16 });
  expect(received).toHaveBeenCalledTimes(1);
  unsubscribe();
  dispatch(env.window, 'devicemotion', { acceleration: { x: 3, y: 0, z: 0 } });
  expect(received).toHaveBeenCalledTimes(1);
  expect(other).toHaveBeenCalledTimes(2);
  sensors.destroy();
});

it('collects six signals while location stays opt-in and missing fields stay null', async () => {
  const env = environment();
  let locate: PositionCallback = () => {};
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: PositionCallback) => { locate = success; return 7; });
  env.navigator.geolocation = { watchPosition, clearWatch };
  const sensors = createSensors({ environment: env });
  await sensors.start();
  expect(watchPosition).not.toHaveBeenCalled();
  expect(sensors.capabilities()).toMatchObject({ motion: true, orientation: true, location: true, pointer: true, viewport: true, visibility: true });
  dispatch(env.window, 'deviceorientation', { alpha: 20, beta: 5, gamma: null, absolute: false });
  expect(sensors.orientation.getSnapshot()).toMatchObject({ alpha: 20, gamma: null, absolute: false });
  dispatch(env.window, 'pointerdown', { pointerId: 1, clientX: 12, clientY: 24, pressure: 0.5, pointerType: 'touch' });
  expect(sensors.pointer.getSnapshot()).toMatchObject({ x: 12, y: 24, pointerId: 1, phase: 'down' });
  expect(sensors.viewport.getSnapshot()).toMatchObject({ width: 390, height: 844, scale: 1 });
  expect(sensors.visibility.getSnapshot()).toBe('visible');
  await sensors.start({ location: true });
  locate({ timestamp: 42, coords: { latitude: 25, longitude: 121, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: null } } as GeolocationPosition);
  expect(sensors.location.getSnapshot()).toMatchObject({ latitude: 25, longitude: 121, speed: null });
  expect(sensors.status.getSnapshot().location.state).toBe('active');
  sensors.destroy();
  expect(clearWatch).toHaveBeenCalledWith(7);
});

it('requests both permissions synchronously and isolates refusal from other sources', async () => {
  const env = environment();
  const calls: string[] = [];
  env.window.DeviceMotionEvent = { requestPermission: () => { calls.push('motion'); return Promise.resolve('denied'); } };
  env.window.DeviceOrientationEvent = { requestPermission: () => { calls.push('orientation'); return Promise.resolve('granted'); } };
  const sensors = createSensors({ environment: env });
  expect(sensors.status.getSnapshot().motion.state).toBe('permission-required');
  const pending = sensors.requestPermission();
  expect(calls).toEqual(['motion', 'orientation']);
  await pending;
  await sensors.start();
  expect(sensors.permissions.getSnapshot()).toMatchObject({ motion: 'denied', orientation: 'granted' });
  expect(sensors.status.getSnapshot().motion.state).toBe('denied');
  dispatch(env.window, 'devicemotion', { acceleration: { x: 99, y: 0, z: 0 } });
  expect(sensors.motion.getSnapshot()).toBeNull();
  dispatch(env.window, 'deviceorientation', { alpha: 10 });
  expect(sensors.orientation.getSnapshot()?.alpha).toBe(10);
  expect(sensors.viewport.getSnapshot()?.width).toBe(390);
  sensors.destroy();
});

it('pauses in the background, respects manual stop, and ignores late permission and location results', async () => {
  const env = environment();
  let success: PositionCallback = () => {};
  env.navigator.geolocation = { watchPosition: callback => { success = callback; return 1; }, clearWatch: vi.fn() };
  const sensors = createSensors({ environment: env, location: true });
  const updates = vi.fn(); sensors.motion.subscribe(updates);
  await sensors.start(); await sensors.start();
  dispatch(env.window, 'devicemotion', { acceleration: { x: 1, y: 0, z: 0 } });
  expect(updates).toHaveBeenCalledTimes(1);
  env.document.visibilityState = 'hidden'; dispatch(env.document, 'visibilitychange');
  expect(sensors.status.getSnapshot().motion.state).toBe('paused');
  dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } });
  expect(updates).toHaveBeenCalledTimes(1);
  const staleSuccess = success;
  env.document.visibilityState = 'visible'; dispatch(env.document, 'visibilitychange');
  staleSuccess({ timestamp: 1, coords: { latitude: 99, longitude: 99 } } as GeolocationPosition);
  expect(sensors.location.getSnapshot()).toBeNull();
  dispatch(env.window, 'devicemotion', { acceleration: { x: 3, y: 0, z: 0 } });
  expect(updates).toHaveBeenCalledTimes(2);
  sensors.pause(); dispatch(env.document, 'visibilitychange');
  expect(sensors.status.getSnapshot().motion.state).toBe('paused');
  sensors.resume(); sensors.stop();
  dispatch(env.document, 'visibilitychange');
  expect(sensors.status.getSnapshot().motion.state).toBe('stopped');
  sensors.destroy(); await sensors.start();
  expect(sensors.status.getSnapshot().motion.state).toBe('stopped');
  let resolve!: (value: string) => void;
  env.window.DeviceMotionEvent = { requestPermission: () => new Promise(r => { resolve = r; }) };
  const pendingSensors = createSensors({ environment: env });
  const permission = pendingSensors.requestPermission();
  pendingSensors.destroy(); const before = pendingSensors.permissions.getSnapshot();
  resolve('granted'); await permission;
  expect(pendingSensors.permissions.getSnapshot()).toBe(before);
});

it('throttles each subscriber with the latest trailing value and cancels pending work on pause', async () => {
  vi.useFakeTimers();
  const env = environment(); const sensors = createSensors({ environment: env });
  const slow = vi.fn(); const raw = vi.fn();
  const off = sensors.motion.subscribe(slow, { throttle: 100 }); sensors.motion.subscribe(raw);
  await sensors.start();
  const send = (x: number) => dispatch(env.window, 'devicemotion', { acceleration: { x, y: 0, z: 0 } });
  send(1); vi.advanceTimersByTime(10); send(2); send(3);
  expect(raw).toHaveBeenCalledTimes(3); expect(slow).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(90);
  expect(slow).toHaveBeenCalledTimes(2); expect(slow.mock.lastCall?.[0].acceleration.x).toBe(3);
  send(4); sensors.pause(); vi.advanceTimersByTime(100);
  expect(slow).toHaveBeenCalledTimes(2);
  sensors.resume(); send(5); off(); vi.advanceTimersByTime(100);
  const count = slow.mock.calls.length; send(6); vi.advanceTimersByTime(100);
  expect(slow).toHaveBeenCalledTimes(count);
  sensors.destroy(); expect(vi.getTimerCount()).toBe(0);
});

it('surfaces insecure-context and location exceptions without disabling safe sources', async () => {
  const env = environment(); env.window.isSecureContext = false;
  env.navigator.geolocation = { watchPosition() { throw new Error('blocked'); }, clearWatch() {} };
  const s = createSensors({ environment: env, location: true });
  await expect(s.start()).resolves.toBeUndefined();
  expect(s.status.getSnapshot().motion).toMatchObject({ state: 'error' });
  expect(s.status.getSnapshot().location).toMatchObject({ state: 'error' });
  expect(s.viewport.getSnapshot()?.width).toBe(390);
  s.destroy();
  const secure = environment(); secure.navigator.geolocation = env.navigator.geolocation;
  const b = createSensors({ environment: secure, location: true }); await expect(b.start()).resolves.toBeUndefined();
  expect(b.status.getSnapshot().location.error).toContain('blocked'); b.destroy();
});

it('falls back to touch input when Pointer Events are unavailable', async () => {
  const env = environment(); delete env.window.PointerEvent; env.window.ontouchstart = null;
  const sensors = createSensors({ environment: env });
  expect(sensors.capabilities().pointer).toBe(true); await sensors.start();
  const touch = { identifier: 8, clientX: 40, clientY: 60, force: 0.75 };
  dispatch(env.window, 'touchstart', { changedTouches: { item: () => touch, 0: touch } });
  expect(sensors.pointer.getSnapshot()).toMatchObject({ pointerId: 8, pointerType: 'touch', x: 40, y: 60, pressure: 0.75, phase: 'down' });
  sensors.destroy();
});
