import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createSensors } from '@solitudo-studio/core';
import { useMotion } from '@solitudo-studio/react';
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
