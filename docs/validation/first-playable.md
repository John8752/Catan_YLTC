# First playable validation

## Release candidate

- Profile: `base-3-4`
- Runtime: Node.js 22, pnpm 9
- Browser automation: Playwright 1.62.1, Chromium 151
- Canonical replay seed: `20260820`
- Canonical replay SHA-256: `94538895f05aac0f93b3c0ebb6443490c141eba0fcf7ca1f64cbaaf0032f104c`
- Baseline implementation commit: `f03eef4` (`feat(release): complete first playable quality gate`)
- Validated change commits: `b6d4a95` (frontend stack), `8d9ac2d` (multi-response trade), `f094fbd` (table UI)
- Resource-effect commit: `c4429bc` (authoritative production sources, queued flight and arrival feedback)
- Resource-effect tuning commit: `6415f32` (all triggered hexes shake; 1200ms resource travel)
- Validation date: 2026-08-20

## Evidence

- Pure engine: a legal command stream starts from an empty seeded game, completes snake setup, produces resources, builds roads/settlements/cities and ends immediately at 10 points. Replaying the stream twice produces byte-identical state and events.
- Multi-client browser: three isolated Chromium contexts create and join one room, complete all six settlement/road placements, roll the first turn and converge on the same board.
- Seat behavior: refreshing a participant restores that participant's seat; opening a second tab starts at the welcome screen and does not invent a new role.
- Privacy: server/protocol tests cover seat credentials, opponent-hand redaction, development-card redaction and private history details.
- Responsive: the active game was checked at 390×844 with no horizontal overflow. The captured run also exercised the seven/robber control surface.
- Table UI: the desktop capture keeps the board, bottom private player dock and internally scrolling public sidebar in one viewport; the mobile capture keeps the same zones in natural document flow.
- Resource feedback: Chromium asserts a live starting-resource event creates a merged flight, reaches the correct private resource target and starts its arrival animation; unit coverage verifies source averaging, opponent targets, reconnect suppression, duplicate-revision suppression and reduced-motion behavior.
- Trigger feedback: engine and projection tests cover matching hexes with no adjacent recipient and bank-withheld resources; Chromium verifies the resource-flight animation duration is at least 1100ms.
- Manual desktop smoke: three independently isolated headed browser sessions completed create/join/start, all setup placements and the first production turn with no console errors.

Browser artifacts are intentionally local-only under `output/playwright/`:

- `setup-start.png`
- `main-turn.png`
- `e2e-desktop.png`
- `e2e-mobile.png`
- `resource-production-fx.png`
- `resource-arrival-fx.png`

## Quality gates

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm validate:full
pnpm validate:full
```

Result: the original release baseline passed the frozen install and two consecutive full gates. The frontend-stack, trade, table and resource-effect changes listed above passed `pnpm validate:full` on 2026-08-20. A negotiated three-human full match remains a product usability exercise; rule completeness and the win path are release-blocking and covered by the canonical full-match replay.
