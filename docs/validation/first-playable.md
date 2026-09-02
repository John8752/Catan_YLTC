# First playable validation

## Release candidate

- Profile: `base-3-4`
- Runtime: Node.js 22, pnpm 9
- Browser automation: Playwright 1.62.1, Chromium 151
- Canonical replay seed: `20260820`
- Canonical replay SHA-256: `789afce4a8108943fd2ebbcb9cc8b163d2552dd8c4c932ee698d81e7804b8a2a`
- Baseline implementation commit: `f03eef4` (`feat(release): complete first playable quality gate`)
- Validated change commits: `b6d4a95` (frontend stack), `8d9ac2d` (multi-response trade), `f094fbd` (table UI)
- Resource-effect commit: `c4429bc` (authoritative production sources, queued flight and arrival feedback)
- Resource-effect tuning commit: `6415f32` (all triggered hexes shake; 1200ms resource travel)
- Validation date: 2026-08-20

## Effect and post-game validation (2026-08-25)

- `pnpm validate:full` passed: TypeScript checks, 117 package tests, production builds, canonical replay, architecture boundaries and 4 Chromium multiplayer/responsive scenarios.
- Protocol coverage verifies that paid build/development costs, post-setup score gains and robber source/destination coordinates are projected through player-safe effects. A rival cannot see a hidden victory-point purchase or a stolen resource identity.
- Web coverage verifies two-second resource travel, two-second robber movement, spend direction/targets, the prominent score overlay, reduced-motion fallback and mobile road confirmation before command submission.
- Every initial-settlement target opens a confirmation dialog before submission on desktop and mobile layouts. A real 390×844 Chromium setup flow also confirms that the first road tap opens a high-contrast confirmation card and only the explicit second confirmation submits the placement.
- Finished-game projection tests cover dice frequencies, resource-card flows, per-resource production, activity counts and deterministic winner copy without development-card identities.

## Server turn-timer validation (2026-08-25)

- `pnpm validate:full` passed: TypeScript checks, 125 package tests, production builds, canonical replay, architecture boundaries and 4 Chromium multiplayer/responsive scenarios.
- Fake-clock server coverage verifies setup remains untimed, roll expires exactly at 5 seconds, ordinary action commands do not refresh the 120-second deadline and expiry executes the normal authoritative `EndTurn` path.
- Protocol and component coverage verifies the player-safe deadline projection, local countdown formatting, urgent-state styling and the dedicated timer slots above the local dock and below an active opponent card.
- A real three-client Chromium setup flow verifies both observers receive the same roll timer, the server automatically rolls without a browser command and the resulting action timer is projected back to the active player.
- The 390×844 captures confirm the alarm badge remains legible above the local avatar card or below the active opponent card without covering names or private resource cards.

## Evidence

- Pure engine: a legal command stream starts from an empty seeded game, completes snake setup, produces resources, builds roads/settlements/cities and ends immediately at 10 points. Replaying the stream twice produces byte-identical state and events.
- Multi-client browser: three isolated Chromium contexts create and join one room, complete all six settlement/road placements, roll the first turn and converge on the same board.
- Seat behavior: refreshing a participant restores that participant's seat; opening a second tab starts at the welcome screen and does not invent a new role.
- Lobby lifecycle: isolated Chromium contexts verify that an explicit leave releases the seat, a returning player can rejoin, a departing host transfers ownership and the final departure deletes the room.
- Privacy: server/protocol tests cover seat credentials, opponent-hand redaction, development-card redaction and private history details.
- Responsive: the active game was checked at 390×844 with no horizontal overflow. The captured run also exercised the seven/robber control surface.
- Table UI: the desktop capture keeps the board, bottom private player dock and internally scrolling public sidebar in one viewport; the mobile capture keeps the same zones in natural document flow.
- Resource feedback: Chromium asserts a live starting-resource event creates a merged flight, reaches the correct private resource target and starts its arrival animation; unit coverage verifies source averaging, opponent targets, reconnect suppression, duplicate-revision suppression and reduced-motion behavior.
- Trigger feedback: engine and projection tests cover matching hexes with no adjacent recipient and bank-withheld resources; Chromium verifies the resource-flight animation duration is at least 1100ms.
- Setup targeting: initial settlement placement uses small static intersection markers across the wide legal set; the stronger pulsing house/city treatment remains reserved for later build actions, with hover and keyboard focus restoring a prominent local cue.
- Board readability: every number token displays one through five dice-probability pips; all six terrain types use distinct original SVG silhouettes over restrained gradients; resource cards and map analysis reuse the same icon language; every coastal port uses a ratio-first sign, two outward wooden approaches and two endpoint halos that expose both valid port vertices.
- Manual desktop smoke: three independently isolated headed browser sessions completed create/join/start, all setup placements and the first production turn with no console errors.

Browser artifacts are intentionally local-only under `output/playwright/`:

- `setup-start.png`
- `main-turn.png`
- `e2e-desktop.png`
- `e2e-mobile.png`
- `e2e-lobby-settings.png`
- `e2e-setup-targets.png`
- `resource-production-fx.png`
- `resource-arrival-fx.png`
- `mobile-road-confirm.png`
- `initial-settlement-confirm.png`
- `mobile-roll-timer.png`
- `mobile-opponent-roll-timer.png`

## Quality gates

Run from the repository root:

```text
pnpm install --frozen-lockfile
pnpm validate:full
pnpm validate:full
```

Result: the original release baseline passed the frozen install and two consecutive full gates. The frontend-stack, trade, table, resource-effect, lobby-settings and lobby-lifecycle changes passed `pnpm validate:full` on 2026-08-20. A negotiated three-human full match remains a product usability exercise; rule completeness and the win path are release-blocking and covered by the canonical full-match replay.
