# @mobile-sensor/vue

Vue composables for an existing `@mobile-sensor/core` instance. Vue 3.5+ is a peer dependency. Hooks return readonly shallow refs and clean up in the current scope.

```ts
const motion = useMotion(sensors, { fps: 8 });
```

## Unified raw data and inferred events

```vue
<script setup lang="ts">
import { onUnmounted } from 'vue';
import { createMobileSensor, useMobileSensor, type MobileSensorOutput } from '@mobile-sensor/vue';

const sensor = createMobileSensor();
const pending: MobileSensorOutput[] = [];
const output = useMobileSensor(sensor, value => pending.push(value));
async function enable() {
  await sensor.requestPermission();
  await sensor.start();
}
onUnmounted(() => sensor.destroy()); // this component owns the instance
</script>
<template>
  <button @click="enable">Enable Sensors</button>
  <pre>{{ output }}</pre>
</template>
```

`useMobileSensor(source, onData?)` returns a readonly shallow ref of the latest `MobileSensorOutput | null`. Its callback receives every raw, gesture and behavior output without throttling; use it to buffer for your backend. Vue can coalesce ref watchers and DOM updates, so watching the latest ref alone is insufficient for lossless collection. Subscription begins on mount and is disposed with the component scope. Unmounting a consumer does not stop a shared source: only its owner should destroy it. SSR returns a null ref without subscribing or starting sensors. Location remains off by default.

The SDK re-exports the factory and its options/output types. Existing composables are unchanged. See [the output contract](../../docs/UNIFIED-API.md).
