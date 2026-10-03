import type { MobileSensorOutput } from '@mobile-sensor/svelte';
import MobileView from './MobileSensorView.svelte';
import { it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/svelte';
import { createSensors } from '@mobile-sensor/core';
import { createSensorStores, createMobileSensorStores, createMobileSensor } from '@mobile-sensor/svelte';
import { environment, dispatch } from './environment';
import View from './SensorView.svelte';
it('provides readable stores for Svelte and cleans up each consumer on unmount', async () => {
  const env = environment(); const a = createSensors({ environment: env }); const b = createSensors({ environment: null });
  const stores = createSensorStores(a); const empty = createSensorStores(b);
  expect(empty.motion.subscribe).toBeTypeOf('function');
  await a.start(); render(View, { props: { motion: stores.motion } });
  dispatch(env.window, 'devicemotion', { acceleration: { x: 4, y: 0, z: 0 } });
  await waitFor(() => expect(screen.getByText('4')).toBeTruthy()); cleanup(); a.destroy(); b.destroy();
});

it('Svelte unified SDK exposes lossless output stores/callbacks and cleans up without stopping shared collection', async () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const env = environment(), sensor = createMobileSensor({ environment: env });
  const stores = createMobileSensorStores(sensor, { fps: 1 });
  const events: unknown[] = [], expected: unknown[] = [], storeEvents: unknown[] = [];
  sensor.onData(output => expected.push(output));
  const unsubscribe = stores.output.subscribe(output => { if (output) storeEvents.push(output); });
  const view = render(MobileView, { props: { stores, onData: (output: MobileSensorOutput) => events.push(output) } }); await sensor.start();
  for (let i = 0; i < 4; i++) { vi.setSystemTime(10000 + i * 100); dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); }
  expect(events).toEqual(expected); expect(storeEvents).toEqual(expected);
  expect(expected.some(output => (output as { kind: string }).kind === 'behavior')).toBe(true);
  await view.unmount(); const count = events.length;
  dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); expect(events).toHaveLength(count); expect(storeEvents).toEqual(expected);
  unsubscribe(); const storeCount = storeEvents.length; dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); expect(storeEvents).toHaveLength(storeCount);
  cleanup(); sensor.destroy(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
});
