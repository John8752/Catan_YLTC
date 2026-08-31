# ADR-0008: Shared adaptive game surface

- Status: Accepted
- Date: 2026-08-25

## Context

The desktop table has enough room for a persistent room rail, board and player dock. A phone needs the same game capabilities inside one viewport: opponents above the board, the private hand and turn actions below it, and secondary information in temporary surfaces. Maintaining separate desktop and mobile game pages would duplicate interaction handling and make new phases easy to omit from one layout.

## Decision

The live match uses one React game surface and one set of feature components. Responsive layout may reposition persistent regions and an adaptive container may present the same content as a desktop rail, popover or mobile bottom sheet, but gameplay content and command wiring are not duplicated.

- `GameView` and its discriminated interaction state remain the only player-visible gameplay input.
- The board, opponent overview, private hand and turn actions each have one component implementation.
- The mobile match is a `100dvh` surface without document scrolling. Opponents occupy a compact top strip, the zoomable SVG board consumes the flexible center, and the local player dock occupies the bottom.
- Secondary information such as public history and room controls is persistent on wide screens and opened through a Radix-managed dialog on phones.
- At desktop widths (at least 1024 CSS pixels), the right rail contains public history, bank supply and opponent summaries in that order. The board and private dock occupy the left column. History keeps a readable minimum height; opponents scroll vertically when a short window cannot fit every row. The same opponent components move back to the top strip on smaller viewports, with only one set of player/effect anchors mounted.
- The bank has one mounted supply/effect anchor, routed to the right rail on desktop and the board heading on compact screens. The local seat uses the same public-score badge as opponents, based only on projected `visibleVictoryPoints`, excluding private victory-point cards.
- The board fits its actual terrain and port-sign bounds into the remaining stage, rather than assuming a fixed amount of space for controls. The wide-screen phase indicator uses corner space; compact screens keep their bank near the board and a zoom-control footer so ports remain readable at the initial fit.
- Desktop game typography uses bounded viewport-responsive `rem` sizing: a 100%–200% root size, scaled by the smaller of `1vw` and `1.8dvh`. This uses CSS viewport dimensions, not physical device pixels. Short/ultrawide windows are height-limited; phone and lobby sizing is unchanged. Exact physical text size cannot be inferred from monitor resolution, and browser/OS zoom remains available.
- Public history presents the newest 30 projected entries in chronological order, appending below and following the bottom. Scrolling up pauses following and exposes a return-to-latest button; retained visible entries keep their reading position as old entries leave the window. Reopening the mobile history sheet starts at the latest entry.
- Trade composition and active negotiation use shared content. Their container adapts to a bottom sheet on phones and a floating panel on wider screens.
- Board pan and zoom are renderer-only state. They never change commands, legality or serialized game state.
- Responsive differences are limited to placement, density, disclosure and input affordances. A feature must not introduce parallel `Mobile*` and `Desktop*` business components.

## Consequences

- Adding a new projected interaction updates one shared renderer and is covered by both desktop and mobile viewport tests.
- Mobile overlays preserve focus, escape and outside-click semantics through Radix primitives.
- Layout tests cover four/six-player matches on phones, short windows, laptops, 1440p/4K CSS viewports and ultrawide screens, plus high-DPI equivalence and public-history scrolling. Rule tests remain headless in `game-core`.
- Lobby pages may continue to scroll; the no-document-scroll constraint applies only after a match starts.
