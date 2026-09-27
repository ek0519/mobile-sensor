import { it, expect, vi, afterEach } from 'vitest';
import { createSensors } from '@mobile-sensor/core';
import { environment, dispatch } from './environment';
afterEach(() => vi.useRealTimers());
it('detects alternating shake peaks before UI sampling, with cooldown and no noise triggers', async () => {
  vi.useFakeTimers(); const env = environment();
  const s = createSensors({ environment: env }); const shake = vi.fn(); const slow = vi.fn();
  s.on('shake', shake); s.motion.subscribe(slow, { throttle: 1000 }); await s.start();
  const send = (x: number) => { dispatch(env.window, 'devicemotion', { acceleration: { x, y: 0, z: 0 } }); vi.advanceTimersByTime(50); };
  send(0.1); send(-0.2); send(0.3); expect(shake).not.toHaveBeenCalled();
  send(15); send(-15); expect(shake).toHaveBeenCalledTimes(1);
  expect(shake.mock.lastCall?.[0]).toMatchObject({ type: 'shake', source: 'motion', intensity: 15 });
  send(16); send(-16); expect(shake).toHaveBeenCalledTimes(1);
  expect(slow).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1100); send(15); send(-15); expect(shake).toHaveBeenCalledTimes(2);
  s.destroy(); expect(vi.getTimerCount()).toBe(0);
});

it('requires sustained evidence for moving and stationary, and returns to unknown after a gap', async () => {
  vi.useFakeTimers(); const env = environment(); const s = createSensors({ environment: env });
  const moving = vi.fn(); const stationary = vi.fn(); s.on('movement', moving); s.on('stationary', stationary);
  await s.start();
  const send = (x: number | null, delay = 100) => { dispatch(env.window, 'devicemotion', { acceleration: { x, y: 0, z: 0 } }); vi.advanceTimersByTime(delay); };
  send(null); expect(s.device.getSnapshot().moving).toBeNull();
  send(2); send(2); send(2); expect(moving).toHaveBeenCalledTimes(1); expect(s.device.getSnapshot().moving).toBe(true);
  send(1.4); send(1.6); expect(moving).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 10; i++) send(0.1);
  expect(stationary).toHaveBeenCalledTimes(1); expect(s.device.getSnapshot().stationary).toBe(true);
  vi.advanceTimersByTime(1100);
  expect(s.device.getSnapshot().moving).toBeNull(); expect(s.device.getSnapshot().stationary).toBeNull();
  send(0); expect(s.device.getSnapshot().stationary).toBeNull();
  s.destroy(); expect(vi.getTimerCount()).toBe(0);
});

it('emits tilt and rotation on entry using hysteresis and configurable thresholds', async () => {
  vi.useFakeTimers(); const env = environment();
  const s = createSensors({ environment: env, detectors: { tiltThreshold: 25, tiltRelease: 15, rotationThreshold: 40, rotationRelease: 20 } });
  const tilt = vi.fn(); const rotation = vi.fn(); s.on('tilt', tilt); s.on('rotation', rotation); await s.start();
  const orient = (gamma: number) => dispatch(env.window, 'deviceorientation', { alpha: 0, beta: 0, gamma });
  orient(24); expect(tilt).not.toHaveBeenCalled(); orient(26); orient(24); orient(26); expect(tilt).toHaveBeenCalledTimes(1);
  expect(s.device.getSnapshot().tilting).toBe(true);
  orient(10); orient(-30); expect(tilt).toHaveBeenCalledTimes(2);
  const rotate = (alpha: number) => dispatch(env.window, 'devicemotion', { rotationRate: { alpha, beta: 0, gamma: 0 } });
  rotate(39); rotate(45); rotate(39); rotate(45); expect(rotation).toHaveBeenCalledTimes(1);
  rotate(0); rotate(-50); expect(rotation).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(1100);
  expect(s.device.getSnapshot().tilting).toBeNull(); expect(s.device.getSnapshot().rotating).toBeNull();
  s.destroy();
});

it('rejects detector thresholds that would make the public trigger rules ambiguous', () => {
  expect(() => createSensors({ environment: null, detectors: { shakeThreshold: Number.NaN } })).toThrow(RangeError);
  expect(() => createSensors({ environment: null, detectors: { movementThreshold: 0.5, stationaryThreshold: 1 } })).toThrow(RangeError);
  expect(() => createSensors({ environment: null, detectors: { tiltRelease: 21, tiltThreshold: 20 } })).toThrow(RangeError);
});
