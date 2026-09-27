# @mobile-sensors/svelte

Readable store adapters for an existing `@mobile-sensors/core` instance. Svelte 5 is a peer dependency. Store subscriptions clean up with the consuming component.

```svelte
<script>
  const { motion } = createSensorStores(sensors);
</script>
<p>{$motion?.acceleration.x ?? 'waiting'}</p>
```
