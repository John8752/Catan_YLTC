# ADR-0005: Frontend stack and interaction primitives

- Status: accepted
- Date: 2026-08-20

## Decision

The browser client uses React with TypeScript, Tailwind CSS v4, repository-owned shadcn/ui components and Radix UI primitives. The SVG board remains a focused renderer inside the React application.

Tailwind utilities are the default for product-component layout and styling. Shared visual tokens and SVG renderer rules stay in `apps/web/src/styles.css`. Accessible interaction behavior such as dialogs, tabs, focus trapping, escape handling and outside-click handling comes from Radix primitives through the shadcn component layer.

## Boundaries

- `apps/web/src/components/ui` contains shared shadcn-style primitives.
- `apps/web/src/components` composes game-specific UI from those primitives.
- `apps/web/src/lib/utils.ts` owns Tailwind class composition through `cn`.
- Rules, serializable state and legality remain in `game-core`; player-safe projection remains in `protocol`.
- UI packages do not cross into `game-core`, `protocol` or the server.
- Hand-written global CSS may style the SVG board and define tokens, but must not become a parallel general-purpose component system.

## Consequences

- New dialogs and menus inherit accessible keyboard and focus behavior instead of reimplementing it.
- Agents have one styling vocabulary and one shared component location.
- Existing CSS can be migrated incrementally, but every materially changed product component must use the chosen stack rather than expanding legacy selectors.
- Replacing this stack requires a superseding ADR and an update to `AGENTS.md` in the same change.
