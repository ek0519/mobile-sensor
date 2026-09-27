# Sensor and detector behavior

Each source has its own capability and lifecycle state. Missing or unsupported measurements remain null. Sensor data is processed in this browser and is never sent by this library.

| Channel | Source | Normalized fields |
|---|---|---|
| motion | DeviceMotionEvent | acceleration vectors, angular rates, sample interval and timestamp |
| orientation | DeviceOrientationEvent | alpha, beta, gamma in degrees, absolute flag and timestamp |
| location | Geolocation.watchPosition | coordinates, accuracy and available speed/heading/altitude |
| pointer | Pointer Events | pointer id/type, position, pressure and phase |

Location starts only when the caller passes { location: true }. Motion and orientation permission methods are called synchronously by requestPermission() before it awaits their promises, so callers can invoke it inside a click/tap handler. Secure context is required by the relevant browser APIs. Unsupported sensors and each source permission/error status do not prevent other sources from running. The core uses page visibility internally to pause/resume active sensors, but does not expose it as a channel.

## Touch press zones

Touch divides the viewport into left and right press zones with a 100 CSS-pixel inactive band centered on the screen. A pointer is assigned according to its initial down position and keeps that side until `up` or `cancel`. The `left-press` and `right-press` events fire when a side changes from unpressed to pressed; multiple pointers on one side keep its state true until the last one leaves. `device.leftPressed` and `device.rightPressed` expose the current held states, allowing callers to derive simultaneous presses without a third combined event. The pointer event's pressure value is passed through as raw data but is not used as physical force detection.

## Detector defaults

The defaults are heuristic starting points, not calibrated across devices. Applications can override them with createSensors({ detectors: { ... } }). All thresholds and durations must be finite and non-negative. The movement threshold must exceed the stationary threshold; each release threshold must be at or below its activation threshold.

| Detector | Default rule |
|---|---|
| shake | Two high acceleration samples pointing in opposite directions, at least 12 m/s² and within 500 ms; the detected state remains visible through the 1 s cooldown |
| movement | Acceleration magnitude at least 1.5 m/s² for 150 ms |
| stationary | Acceleration magnitude at most 0.8 m/s² for 800 ms |
| tilt | Change from the first valid orientation sample reaches 20°; releases at 15° |
| tilt-direction | Dominant calibrated beta/gamma change; positive beta is forward, negative beta backward, positive gamma right, negative gamma left |
| rotation | Rotation-rate magnitude reaches 30°/s; releases at 20°/s |
| direction | Dominant linear X/Y acceleration reaches 2.5 m/s²; +X right, -X left, +Y up, -Y down. Signed alpha rotation rate at 30°/s adds rotate-right/rotate-left. Directions have a 400 ms cooldown. |

Orientation uses the first valid sample after starting or resuming as its neutral pose. In the device's portrait reference frame, beta describes front/back tilt (positive beta tips the phone toward the user) and gamma describes left/right tilt (positive gamma tips right). These labels describe rotation relative to the starting pose; they do not tell whether the phone itself was lifted or lowered through space. The tilt direction resets after returning within 15° of the neutral pose. Motion directions are short gesture estimates from sensor axes; they do not track position or guarantee consistent results across device models and holding styles.

The movement and stationary classifications include duration and hysteresis; they do not claim walking, running or vehicle detection. A 1 s gap in relevant readings returns derived state to unknown. Pause, stop and destroy clear pending detector and subscriber timers.
