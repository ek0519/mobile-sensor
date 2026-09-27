# TDD execution log

Approved seams: core public channels, lifecycle, permissions and detector events; framework adapter usage; packed package consumption; demo operation. Each implementation slice ran a failing public-interface test before the smallest change that made it pass. The red result records the initial missing behavior, and the green result records the passing suite.

| Slice | Red observation | Green result |
|---|---|---|
| Independent snapshots | Core package entry did not exist. | Independent instances and stable unknown snapshots passed. |
| Motion channel | Motion channel lacked subscribe. | Normalization, null handling and unsubscribe passed. |
| Six signals | Capability detection was missing. | All channels and opt-in location passed. |
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
| Touch fallback | Touch-only browsers reported unsupported. | Touch Events normalize to the pointer channel. |

Final Vitest suite: 15 tests across core, detector, React, Vue and Svelte suites. Chromium end-to-end coverage is in tests/e2e/demo.spec.ts; packed install/type-consumer checks run via bun run test:pack.

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
