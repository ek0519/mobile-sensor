import { it, expect, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/svelte';
import { createSensors } from '@mobile-sensors/core';
import { createSensorStores } from '@mobile-sensors/svelte';
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
