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
- Trade composition and active negotiation use shared content. Their container adapts to a bottom sheet on phones and a floating panel on wider screens.
- Board pan and zoom are renderer-only state. They never change commands, legality or serialized game state.
- Responsive differences are limited to placement, density, disclosure and input affordances. A feature must not introduce parallel `Mobile*` and `Desktop*` business components.

## Consequences

- Adding a new projected interaction updates one shared renderer and is covered by both desktop and mobile viewport tests.
- Mobile overlays preserve focus, escape and outside-click semantics through Radix primitives.
- Layout tests must cover at least a phone viewport and a desktop viewport, while rule tests remain headless in `game-core`.
- Lobby pages may continue to scroll; the no-document-scroll constraint applies only after a match starts.
