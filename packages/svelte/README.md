# @mobile-sensor/svelte

Readable store adapters for an existing `@mobile-sensor/core` instance. Svelte 5 is a peer dependency. Store subscriptions clean up with the consuming component.

```svelte
<script>
  const { motion } = createSensorStores(sensors);
</script>
<p>{$motion?.acceleration.x ?? 'waiting'}</p>
```

## Unified raw data and inferred events

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createMobileSensor, createMobileSensorStores, type MobileSensorOutput } from '@mobile-sensor/svelte';

  const sensor = createMobileSensor();
  const stores = createMobileSensorStores(sensor);
  const output = stores.output;
  const pending: MobileSensorOutput[] = [];
  onMount(() => {
    const unsubscribe = stores.onData(value => pending.push(value));
    return () => { unsubscribe(); sensor.destroy(); }; // this component owns the instance
  });
  async function enable() {
    await sensor.requestPermission();
    await sensor.start();
  }
</script>
<button onclick={enable}>Enable Sensors</button>
<pre>{JSON.stringify($output)}</pre>
```

`createMobileSensorStores(source, { fps? })` includes all existing channel/event stores plus `output`, a readable store of `MobileSensorOutput | null`, and `onData(handler)`, which returns an unsubscribe function. `fps` affects the old UI channel stores only. Unified outputs and direct callbacks are unthrottled. For uploading, use a direct callback or a synchronous `output.subscribe()` subscriber; reactive UI effects may see only the latest output in a burst. Direct callbacks must be unsubscribed by their owner (the example uses onMount cleanup). `$output` subscriptions clean up automatically with the component. Store cleanup does not stop a shared sensor; only the instance owner should destroy it. Store creation does not start sensors; SSR has no browser samples and no automatic permission requests. Location remains off by default.

The SDK re-exports the factory and its options/output types. Existing stores are unchanged. See [the output contract](../../docs/UNIFIED-API.md).
