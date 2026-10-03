# @mobile-sensor/react

React hooks for an existing `@mobile-sensor/core` instance. React 18+ is a peer dependency.

```tsx
const motion = useMotion(sensors, { fps: 8 });
```

## Unified raw data and inferred events

```tsx
import { createMobileSensor, useMobileSensor, type MobileSensor, type MobileSensorOutput } from '@mobile-sensor/react';

// Create one sensor per application/request; the owner destroys it when finished.
const sensor = createMobileSensor();
const pending: MobileSensorOutput[] = [];
const collect = (output: MobileSensorOutput) => pending.push(output);

function SensorView({ sensor }: { sensor: MobileSensor }) {
  const output = useMobileSensor(sensor, collect);
  async function enable() {
    await sensor.requestPermission(); // invoked by the button's user gesture
    await sensor.start();
  }
  return <><button onClick={enable}>Enable Sensors</button><pre>{JSON.stringify(output)}</pre></>;
}
```

`useMobileSensor(source, onData?)` returns the latest `MobileSensorOutput | null`. The optional callback receives every raw, gesture and behavior output without throttling. Use this callback for buffering/uploading: React may coalesce renders, so an effect watching only the latest output can miss intermediate samples. It subscribes after mount and unsubscribes on unmount/source or callback changes, without stopping an instance shared by another consumer. SSR returns null and does not subscribe or start sensors. Keep the source instance stable across renders and keep callbacks stable when practical. Acquisition/permission and final `destroy()` remain the instance owner's responsibility. Location remains off by default.

The SDK re-exports `createMobileSensor`, `MobileSensor`, `MobileSensorOptions`, `MobileSensorStartOptions`, `MobileSensorOutput` and `MobileSensorEvent`. Existing hooks are unchanged. See [the output contract](../../docs/UNIFIED-API.md).
