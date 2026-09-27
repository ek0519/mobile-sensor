# TDD execution log

Approved seams: core public channels, lifecycle, permissions and detector events; framework adapter usage; packed package consumption; demo operation. Each implementation slice ran a failing public-interface test before the smallest change that made it pass. The red result records the initial missing behavior, and the green result records the passing suite.

| Slice | Red observation | Green result |
|---|---|---|
| Independent snapshots | Core package entry did not exist. | Independent instances and stable unknown snapshots passed. |
| Motion channel | Motion channel lacked subscribe. | Normalization, null handling and unsubscribe passed. |
| Original six-signal API | Capability detection was missing. | All original channels and opt-in location passed before the scope was narrowed. |
| Permissions | Motion permission state was not exposed. | Synchronous requests, denial isolation and orientation passed. |
| Lifecycle | Background transition did not pause. | Repeated start, background, manual pause, stale callback and destroy passed. |
| Sampling | Per-subscriber throttle was missing. | Trailing latest value and timer cancellation passed. |
| Shake | Detector event interface was missing. | Alternating peaks, noise rejection and cooldown passed before UI throttle. |
| Movement and stale data | Sustained movement detection was missing. | Movement/stationary durations and unknown after data gap passed. |
| Tilt and rotation | Orientation detectors were missing. | Entry/release hysteresis and configurable thresholds passed. |
| Source failures | Geolocation exceptions escaped start. | HTTPS and location failures stayed source-local. |
| React adapter | React package entry was missing. | SSR, sampled updates, shared consumers and unmount cleanup passed. |
| Vue adapter | Vue package entry was missing. | SSR, sampled refs, multiple consumers and scope cleanup passed. |
| Svelte adapter | Svelte store package entry was missing. | Component store updates and teardown passed; the test waits for the documented sampling interval. |
| Detector options | Invalid thresholds were accepted. | Invalid values and ambiguous hysteresis were rejected. |
| Motion directions | Direction event had no implementation. | Four X/Y directions, signed yaw turns, null-axis handling, threshold and cooldown passed. |
| Orientation tilt direction | Orientation only exposed generic tilt. | Calibrated forward/back/left/right tilt labels and stale cleanup passed. |
| Touch fallback | Touch-only browsers reported unsupported. | Touch Events normalize to the pointer channel. |
| Four-channel API scope | The public API still listed Viewport and Visibility in capabilities. | Core, adapters, and packed declarations expose only Motion, Orientation, Location, and Touch. Page Visibility remains internal for lifecycle pause/resume. |

Final Vitest suite before directional work: 15 tests across core, detector, React, Vue and Svelte suites. Chromium end-to-end coverage is in tests/e2e/demo.spec.ts; packed install/type-consumer checks run via bun run test:pack.

## Direction detection TDD results

- Linear direction red: `preserves motion coordinates and reports the dominant rightward direction` emitted no direction event. Green: the public `direction` event and `device.direction` reported right while X/Y/Z remained available.
- Partial axes red: X/Y could not classify when Z was null. Green: direction uses the available screen axes while the raw missing Z value remains null.
- Cooldown red: a held opposite acceleration replayed as a second gesture after cooldown. Green: a fresh neutral period is required before another event.
- Rotation red: signed rotation-rate alpha emitted no left/right direction. Green: positive and negative angular turns report rotate-right and rotate-left.
- Orientation red: only generic tilt was available. Green: a starting-pose baseline distinguishes forward, backward, left and right and clears after release/stale data.
- Shake display red: the UI state returned to false on the very next motion frame. Green: the shake result stays visible through cooldown and its timer clears on destroy.

The expanded Vitest suite now has 22 tests across core, detectors, React, Vue and Svelte. The new browser checks verify that the Motion visual reports linear and rotational directions and shake, and Orientation reports calibrated front/back tilt.

## 16 Final regression suite GREEN — exit 0

 Test Files  5 passed (5)
      Tests  15 passed (15)

## 17 Centered fixed phone frame RED — exit 0

 Test Files  5 passed (5)
      Tests  15 passed (15)

## 17 Centered fixed phone frame RED — exit 1

error: script "test:e2e" exited with code 1

## 17 Centered fixed phone frame GREEN — exit 0

No test summary was printed.

## 18 Swipeable sensor/event pages RED — exit 1

error: script "test:e2e" exited with code 1

## 18 Swipeable sensor/event pages GREEN — exit 0

No test summary was printed.

## 19 Single-screen phone layout GREEN — exit 0

Playwright: the 390×844 phone viewport and 716×798 desktop viewport use the same fixed-width phone UI. Sensor cards and the empty event page fit their horizontal page; no vertical scrolling is needed.

## 20 No-scroll event view RED — exit 1

Playwright: at 716×798 the event page needed 442px inside a 416px horizontal page.

## 21 NES.css integration RED — exit 1

Playwright: the framework's component spacing and borders caused the fixed phone pages to overflow.

## 22 NES.css compact layout GREEN — exit 0

Playwright: the NES-styled sensor and event pages fit at 716×798 and 390×844 without vertical scrolling. The event page keeps the 200-event in-memory buffer and shows its two latest rows.

## 23 Morandi palette regression GREEN — exit 0

Vitest: 15 passed. Playwright: 3 passed. Typecheck and production build passed; both phone page views report zero vertical overflow at 716×798 and 390×844.

## 24 Optional demo CSS removal GREEN — exit 0

Removed NES.css from the demo dependency, import, and markup. The Morandi layout remains one-screen: Vitest 15 passed, Playwright 3 passed, typecheck and production build passed, and both pages have zero vertical overflow at 716×798.

## Direction and orientation regression verification — 2026-09-27

- `bun run test`: 22 tests passed across 5 files.
- `bun run typecheck`: TypeScript and Svelte checks passed with 0 errors and 0 warnings.
- `bun run build`: all four ESM/declaration packages and the Svelte demo production bundle built.
- `bun run test:e2e`: 4 Playwright tests passed, including linear/turn directions, shake feedback, forward/back tilt, and the fixed phone viewport.
- `bun run test:pack`: all four packed packages imported and consumer TypeScript declarations compiled.
- `git diff --check`: passed.

## Left/right touch press zones — 2026-09-28

- Red: three new public-interface tests failed because left/right pressed state and events did not exist, a second pointer did not maintain a zone state, and the fallback handled only one changed touch. The centered dead-zone assertion was added before implementing the zone classifier.
- Green: all core tests passed with separate left/right events, simultaneous held states, touchdown-side locking, multi-touch fallback iteration, stop cleanup, and a centered 100 CSS-pixel dead zone.
- Full verification: Vitest 26 passed; Playwright 6 passed; TypeScript/Svelte diagnostics passed with no errors or warnings; production build passed; all four packed packages and consumer declarations passed; `git diff --check` passed.

## Four-channel package scope and catalog icons — 2026-09-28

- Red: the core public-interface test showed `capabilities()` still included Viewport and Visibility; the catalog test still saw six cards; and the icon-size check measured 27px.
- Green: the core exposes only Motion, Orientation, Location, and Touch; Svelte stores and packed declarations omit Viewport/Visibility; the demo catalog contains four cards with 42px icons (34px on short screens).
- Verification: Vitest 26 passed; TypeScript/Svelte diagnostics passed with no errors or warnings; Playwright 6 passed; packed ESM imports and consumer declarations passed; production build and `git diff --check` passed.
