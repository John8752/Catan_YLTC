# ADR-0008: Shared adaptive game surface

- Status: Accepted
- Date: 2026-08-25

## Context

The desktop table has enough room for a persistent room rail, board and player dock. A phone needs the same game capabilities inside one viewport: opponents above the board, the private hand and turn actions below it, and secondary information in temporary surfaces. Maintaining separate desktop and mobile game pages would duplicate interaction handling and make new phases easy to omit from one layout.

## Decision

The live match uses one React game surface and one set of feature components. Responsive layout may reposition persistent regions and an adaptive container may present the same content as a desktop rail, popover or mobile bottom sheet, but gameplay content and command wiring are not duplicated.

- `GameView` and its discriminated interaction state remain the only player-visible gameplay input.
- The board, opponent overview, private hand and turn actions each have one component implementation.
- The mobile match is a `100dvh` surface without document scrolling. Opponents occupy a compact top strip, the fixed-scale movable SVG board consumes the flexible center, and the local player dock occupies the bottom.
- Secondary information such as public history and room controls is persistent on wide screens and opened through a Radix-managed dialog on phones.
- Updated 2026-08-31: at widths of at least 1280 CSS pixels, the live match uses three columns: a 12.5rem opponent rail, the flexible full-height map, and a 22.5rem information/action rail (200px and 360px at the default root size). Opponents scroll independently in the left rail. The right rail contains public history, bank supply, phase/action information and the vertically arranged private dock. History consumes the remaining height; the dock does not shrink or scroll with history, so its required actions stay at the bottom. At 1024–1279px, opponents stay in a horizontal strip above the map to avoid squeezing the map between two rails. Below 1024px the existing compact surface remains. Each player/effect anchor is mounted once across breakpoints.
- The bank has one mounted effect anchor, routed to the right-rail supply on desktop and a bank button on compact screens. The button opens the same live supply content in a Radix dialog; that content does not duplicate the effect anchor. The local seat uses the same public-score badge as opponents, based only on projected `visibleVictoryPoints`, excluding private victory-point cards.
- The host's pre-game bank-count visibility setting is applied in the server's protocol projection. Hidden stock is `null`, not a concealed number in the DOM; the same five icon cards and bank effect anchor remain mounted. The option does not change supply rules or existing public action history.
- A fixed-height, non-interactive notice slot lives with phase information in the desktop right rail and above the board on compact screens. The desktop slot shows the persistent action instruction between transient notices; notices do not cover tiles or resize the map. The shared dock uses persistent phase-specific emphasis and returns to its ordinary style while waiting. The right rail contains no map controls, and the desktop map reserves no header/footer space for them.
- The board first fits its actual terrain and port-sign bounds into the remaining stage, then applies a uniform 1.08 presentation scale. Terrain remains visible while outer port signs may cross the clipped stage edge by a bounded amount and can be reached by direct panning. Port signs use a compact 48×56 icon-over-ratio design in SVG world coordinates, with a 24-unit resource icon and 21-unit ratio type separated by a small non-overlapping gap. Resource icons identify dedicated ports, a question-mark icon identifies generic ports, and Chinese descriptions remain in accessible labels only. Ports, text, terrain and pieces always share the same presentation transform: no inverse-scale font floors, screen-pixel port sizing or viewport-dependent port repositioning. Relative proportions remain identical across resolutions.
- Compact screens have one toolbar row for bank, phase and history; map tools are not displayed. There is no additional board footer repeating the dock instruction. Optional dock actions start collapsed, with one phase-specific prompt and roll result still visible. Rolling, discarding and selecting a robber victim remain directly accessible. Selecting a build collapses optional controls to expose the board again; desktop controls stay expanded.
- Short phone landscapes (600–1023 CSS pixels wide, at most 500 pixels high) place the private dock in a 14rem right column below a full-width opponent strip. Dock details scroll internally without shrinking the map further. Other compact screens retain the top-strip/center-board/bottom-dock layout.
- Desktop game typography uses bounded viewport-responsive `rem` sizing: a 100%–200% root size, scaled by the smaller of `1vw` and `1.8dvh`. This uses CSS viewport dimensions, not physical device pixels. Short/ultrawide windows are height-limited; phone and lobby sizing is unchanged. Exact physical text size cannot be inferred from monitor resolution, and browser/OS zoom remains available.
- Public history presents the newest 30 projected entries in chronological order, appending below and following the bottom. Scrolling up pauses following and exposes a return-to-latest button; retained visible entries keep their reading position as old entries leave the window. Reopening the mobile history sheet starts at the latest entry. Viewport/content resizing must not be mistaken for upward reading when a scroll event arrives before ResizeObserver.
- Trade composition and active negotiation use shared content. Their container adapts to a bottom sheet on phones and a floating panel on wider screens.
- Board panning and its fixed presentation scale are renderer-only state. Direct drag, arrow-key movement and double-click/Home recentering never change commands, legality or serialized game state.
- Responsive differences are limited to placement, density, disclosure and input affordances. A feature must not introduce parallel `Mobile*` and `Desktop*` business components.

## Consequences

- Adding a new projected interaction updates one shared renderer and is covered by both desktop and mobile viewport tests.
- Mobile overlays preserve focus, escape and outside-click semantics through Radix primitives.
- Layout tests cover four/six-player matches on phones, short windows, laptops, 1440p/4K CSS viewports and ultrawide screens, plus high-DPI equivalence and public-history scrolling. Rule tests remain headless in `game-core`.
- Lobby pages may continue to scroll; the no-document-scroll constraint applies only after a match starts.
