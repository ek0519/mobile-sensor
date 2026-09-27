# Sensor and detector behavior

Each source has its own capability and lifecycle state. Missing or unsupported measurements remain null. Sensor data is processed in this browser and is never sent by this library.

| Channel | Source | Normalized fields |
|---|---|---|
| motion | DeviceMotionEvent | acceleration vectors, angular rates, sample interval and timestamp |
| orientation | DeviceOrientationEvent | alpha, beta, gamma in degrees, absolute flag and timestamp |
| location | Geolocation.watchPosition | coordinates, accuracy and available speed/heading/altitude |
| pointer | Pointer Events | pointer id/type, position, pressure and phase |
| viewport | Visual Viewport and resize events | dimensions, offsets, scale and timestamp |
| visibility | Page Visibility | visible or hidden |

Location starts only when the caller passes { location: true }. Motion and orientation permission methods are called synchronously by requestPermission() before it awaits their promises, so callers can invoke it inside a click/tap handler. Secure context is required by the relevant browser APIs. Unsupported sensors and each source permission/error status do not prevent other sources from running.

## Detector defaults

The defaults are heuristic starting points, not calibrated across devices. Applications can override them with createSensors({ detectors: { ... } }). All thresholds and durations must be finite and non-negative. The movement threshold must exceed the stationary threshold; each release threshold must be at or below its activation threshold.

| Detector | Default rule |
|---|---|
| shake | Two high acceleration samples pointing in opposite directions, at least 12 m/s² and within 500 ms; 1 s cooldown |
| movement | Acceleration magnitude at least 1.5 m/s² for 150 ms |
| stationary | Acceleration magnitude at most 0.8 m/s² for 800 ms |
| tilt | Maximum absolute beta/gamma reaches 20°; releases at 15° |
| rotation | Rotation-rate magnitude reaches 30°/s; releases at 20°/s |

The movement and stationary classifications include duration and hysteresis; they do not claim walking, running or vehicle detection. A 1 s gap in relevant readings returns derived state to unknown. Pause, stop and destroy clear pending detector and subscriber timers.
