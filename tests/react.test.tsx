import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createSensors } from '@mobile-sensor/core';
import { useMotion, useMobileSensor, createMobileSensor } from '@mobile-sensor/react';
import { environment, dispatch } from './environment';
it('renders sampled motion, supports SSR, and unmounts without stopping another consumer', async () => {
  vi.useFakeTimers(); const env = environment(); const a = createSensors({ environment: env }); const b = createSensors({ environment: null });
  function View({ sensors = a }: { sensors?: typeof a }) { const motion = useMotion(sensors); return <span>{motion?.acceleration.x ?? 'unknown'}</span>; }
  expect(renderToString(<View sensors={b} />)).toContain('unknown');
  await a.start(); const first = render(<View />); const second = render(<View />);
  act(() => dispatch(env.window, 'devicemotion', { acceleration: { x: 1, y: 0, z: 0 } }));
  expect(first.container.textContent).toBe('1');
  act(() => { vi.advanceTimersByTime(10); dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); });
  expect(first.container.textContent).toBe('1');
  act(() => vi.advanceTimersByTime(90)); expect(first.container.textContent).toBe('2');
  first.unmount();
  act(() => { vi.advanceTimersByTime(100); dispatch(env.window, 'devicemotion', { acceleration: { x: 3, y: 0, z: 0 } }); });
  expect(second.container.textContent).toBe('3'); expect(b.motion.getSnapshot()).toBeNull();
  second.unmount(); a.destroy(); b.destroy(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
});

it('React unified SDK preserves every output in callbacks, supports SSR and isolates consumer cleanup', async () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const env = environment(), sensor = createMobileSensor({ environment: env });
  const firstEvents: unknown[] = [], secondEvents: unknown[] = [], expected: unknown[] = [];
  const callback = (output: unknown) => firstEvents.push(output);
  const callback2 = (output: unknown) => secondEvents.push(output);
  sensor.onData(output => expected.push(output));
  function View({ onData }: { onData: (output: unknown) => void }) {
    const output = useMobileSensor(sensor, onData);
    return <span>{output ? `${output.kind}:${output.seq}` : 'waiting'}</span>;
  }
  expect(renderToString(<View onData={callback} />)).toContain('waiting');
  expect(firstEvents).toHaveLength(0);
  const first = render(<React.StrictMode><View onData={callback} /></React.StrictMode>);
  const second = render(<View onData={callback2} />);
  await sensor.start();
  act(() => { for (let i = 0; i < 4; i++) { vi.setSystemTime(10000 + i * 100); dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); } });
  expect(firstEvents).toEqual(expected); expect(secondEvents).toEqual(expected);
  expect(expected.some(output => (output as { kind: string }).kind === 'behavior')).toBe(true);
  expect(first.container.textContent).toBe(second.container.textContent);
  first.unmount(); const count = firstEvents.length;
  act(() => dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }));
  expect(firstEvents).toHaveLength(count); expect(secondEvents).toEqual(expected);
  second.unmount(); sensor.destroy(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
});
