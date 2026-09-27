import { it, expect, vi } from 'vitest';
import { createApp, createSSRApp, h, nextTick } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createSensors } from '@mobile-sensors/core';
import { useMotion } from '@mobile-sensors/vue';
import { environment, dispatch } from './environment';
it('renders Vue refs with sampling, SSR and scoped unsubscribe', async () => {
  vi.useFakeTimers(); const env = environment(); const s = createSensors({ environment: env });
  const component = { setup() { const motion = useMotion(s); return () => h('span', String(motion.value?.acceleration.x ?? 'unknown')); } };
  expect(await renderToString(createSSRApp(component))).toContain('unknown');
  await s.start(); const host = document.createElement('div'); const host2 = document.createElement('div');
  const app = createApp(component); const app2 = createApp(component); app.mount(host); app2.mount(host2);
  dispatch(env.window, 'devicemotion', { acceleration: { x: 1, y: 0, z: 0 } }); await nextTick(); expect(host.textContent).toBe('1');
  vi.advanceTimersByTime(10); dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); await nextTick(); expect(host.textContent).toBe('1');
  vi.advanceTimersByTime(90); await nextTick(); expect(host.textContent).toBe('2');
  app.unmount(); vi.advanceTimersByTime(100); dispatch(env.window, 'devicemotion', { acceleration: { x: 3, y: 0, z: 0 } }); await nextTick(); expect(host2.textContent).toBe('3');
  app2.unmount(); s.destroy(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
});
