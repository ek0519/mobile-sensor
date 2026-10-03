<script lang="ts">
  import { onMount } from 'svelte';
  import type { MobileSensorOutput, createMobileSensorStores } from '@mobile-sensor/svelte';
  let { stores, onData }: { stores: ReturnType<typeof createMobileSensorStores>; onData: (output: MobileSensorOutput) => void } = $props();
  const output = $derived(stores.output);
  onMount(() => stores.onData(onData));
</script>
<span>{$output ? `${$output.kind}:${$output.seq}` : 'waiting'}</span>
