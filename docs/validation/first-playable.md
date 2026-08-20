# First playable validation

## Release candidate

- Profile: `base-3-4`
- Runtime: Node.js 22, pnpm 9
- Browser automation: Playwright 1.62.1, Chromium 151
- Canonical replay seed: `20260820`
- Canonical replay SHA-256: `fb593cf29bc69e29ca5ce03f87106574607fb2c412a53d7582294b093c2ab9c7`
- Implementation commit: `f03eef4` (`feat(release): complete first playable quality gate`)
- Validation date: 2026-08-20

## Evidence

- Pure engine: a legal command stream starts from an empty seeded game, completes snake setup, produces resources, builds roads/settlements/cities and ends immediately at 10 points. Replaying the stream twice produces byte-identical state and events.
- Multi-client browser: three isolated Chromium contexts create and join one room, complete all six settlement/road placements, roll the first turn and converge on the same board.
- Seat behavior: refreshing a participant restores that participant's seat; opening a second tab starts at the welcome screen and does not invent a new role.
- Privacy: server/protocol tests cover seat credentials, opponent-hand redaction, development-card redaction and private history details.
- Responsive: the active game was checked at 390×844 with no horizontal overflow. The captured run also exercised the seven/robber control surface.
- Manual desktop smoke: three independently isolated headed browser sessions completed create/join/start, all setup placements and the first production turn with no console errors.

Browser artifacts are intentionally local-only under `output/playwright/`:

- `setup-start.png`
- `main-turn.png`
- `e2e-mobile.png`

## Quality gates

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm validate:full
pnpm validate:full
```

Result: frozen install passed, then `pnpm validate:full` passed twice consecutively. A negotiated three-human full match remains a product usability exercise; rule completeness and the win path are release-blocking and covered by the canonical full-match replay.
