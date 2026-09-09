# Roll controls and game sounds — 2026-09-08

Compact controls now open when the authoritative interaction enters regular or paired actions. This fixes the forced-open roll panel being reset to closed immediately after the roll. Manual collapse survives unrelated snapshots; selecting a build still makes room for map placement. Returning from seven's mandatory resolution opens the action controls again.

Two original synthesized cues distinguish confirmed rolls (0.65 seconds of tumbling clicks, heard by all seats) from the viewer's setup/turn/paired-action opportunity (0.85-second rising chime). The table's sound button remembers its mute preference locally. Audio follows player-safe protocol effects, independently of the visual queue; seven and rolls with no production still produce a cue. Initial/reconnect snapshots, duplicates and stale revisions stay quiet. Locked or muted cues are consumed, never saved for later playback.

AudioContext is created/resumed during a user gesture and feature-detected; unavailable or rejected audio does not block commands. The implementation follows [MDN's Web Audio autoplay guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). Browser/OS audio policies still govern physical playback.

## Automated verification

- `pnpm validate` passed: `pnpm check`, `pnpm test` (306 tests), and `pnpm build`. Vite reports its non-fatal bundle-size advisory.
- `pnpm test:e2e:mobile` passed: 33 Chromium primary-phone regressions, including eight deterministic real-engine roll → directly click End Turn flows with real AudioContext source playback, distinct cue durations, duplicate delivery and mute/unmute checks.
- `pnpm exec playwright test tests/e2e/game-sounds.spec.ts tests/e2e/development-confirmation.spec.ts tests/e2e/room-transport.spec.ts tests/e2e/trade-counteroffer.spec.ts tests/e2e/adaptive-layout.spec.ts --grep-invert @primary-phone` passed: 40 regressions covering desktop audio, compatibility layouts, trade, development confirmation and transport recovery.
- Unit coverage checks dice projection for seven/no production, turn-only chime projection, repeated opportunities, initial/reconnect/stale suppression, setup/paired action, gesture listeners, muted/suspended/unsupported audio, cleanup and bounded synthesized samples. Dice audio is excluded from the visual queue.

## Viewports and visual review

All eight four-/six-player primary portrait layout screenshots were inspected at CSS-pixel scale. Browser contexts use DPR 3 and touch emulation from `tests/e2e/viewport-cases.ts`.

| Model | Full canvas | Installed browser-area descriptor |
| --- | --- | --- |
| iPhone 16 | 393×852 | 393×659 |
| iPhone 16 Pro Max | 440×956 | 440×763 |

Controls remain inside the viewport with no document overflow. Bank/map disclosures, build-mode collapse, required actions, port/hex and text/hex proportions, separate port icon/ratio rows and number-token clearance pass automated checks. Review images are in ignored `output/playwright/adaptive-{4,6}-{width}x{height}.png`; roll-flow screenshots are emitted as Playwright test artifacts.

Remaining visual limitations: the six-player 393×659 view has roughly 7 CSS-pixel port text with the action panel open. The existing 1.08 resting board scale allows bounded port-edge clipping; the 393×852 six-player screenshot also shows a lower-right port partly covered by zoom controls. Automated containment/ratio checks do not establish comfortable readability or rule out overlay occlusion. Users can manually collapse the actions and pan/zoom the map.

These runs use desktop Chromium emulation, not iOS Safari. Physical-device sound quality, autoplay recovery after backgrounding, silent-switch behavior, browser chrome and notch/home-indicator insets were not verified. No viewport/safe-area implementation was changed in this task.
