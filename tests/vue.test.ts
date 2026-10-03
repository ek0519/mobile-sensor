import { it, expect, vi } from 'vitest';
import { createApp, createSSRApp, h, nextTick } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createSensors } from '@mobile-sensor/core';
import { useMotion, useMobileSensor, createMobileSensor } from '@mobile-sensor/vue';
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

it('Vue unified SDK streams every output into callbacks and unsubscribes each mounted consumer', async () => {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const env = environment(), sensor = createMobileSensor({ environment: env });
  const events: unknown[] = [], events2: unknown[] = [], expected: unknown[] = [];
  sensor.onData(output => expected.push(output));
  const component = { setup() { const output = useMobileSensor(sensor, value => events.push(value)); return () => h('span', output.value ? `${output.value.kind}:${output.value.seq}` : 'waiting'); } };
  const component2 = { setup() { const output = useMobileSensor(sensor, value => events2.push(value)); return () => h('span', output.value ? `${output.value.kind}:${output.value.seq}` : 'waiting'); } };
  expect(await renderToString(createSSRApp(component))).toContain('waiting'); expect(events).toHaveLength(0);
  const host = document.createElement('div'), host2 = document.createElement('div');
  const app = createApp(component), app2 = createApp(component2); app.mount(host); app2.mount(host2); await sensor.start();
  for (let i = 0; i < 4; i++) { vi.setSystemTime(10000 + i * 100); dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); }
  await nextTick(); expect(events).toEqual(expected); expect(events2).toEqual(expected); expect(host.textContent).toBe(host2.textContent);
  expect(expected.some(output => (output as { kind: string }).kind === 'behavior')).toBe(true);
  app.unmount(); const count = events.length; dispatch(env.window, 'devicemotion', { acceleration: { x: 2, y: 0, z: 0 } }); await nextTick();
  expect(events).toHaveLength(count); expect(events2).toEqual(expected); app2.unmount(); sensor.destroy(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
});
