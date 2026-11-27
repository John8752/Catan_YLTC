---
name: YLTC Tabletop
description: Warm wood, parchment and natural pigments for a shared browser game table.
colors:
  primary: "oklch(0.31 0.055 185)"
  primary-foreground: "oklch(0.98 0.015 86)"
  background: "oklch(0.89 0.035 82)"
  foreground: "oklch(0.27 0.03 185)"
  card: "oklch(0.93 0.04 86)"
  popover: "oklch(0.96 0.025 86)"
  secondary: "oklch(0.86 0.055 80)"
  secondary-foreground: "oklch(0.29 0.03 185)"
  muted: "oklch(0.88 0.025 80)"
  muted-foreground: "oklch(0.51 0.025 175)"
  accent: "oklch(0.62 0.14 42)"
  accent-foreground: "oklch(0.98 0.015 86)"
  destructive: "oklch(0.55 0.19 28)"
  border: "oklch(0.72 0.035 75 / 45%)"
  input: "oklch(0.72 0.035 75 / 55%)"
  ring: "oklch(0.55 0.08 190)"
  ink: "#203433"
  pine: "#163c3a"
  pine-soft: "#24524c"
  ocean: "#2f6f7a"
  parchment: "#f2e5c8"
  parchment-deep: "#e3cea3"
  terracotta: "#b65f43"
  wheat: "#d7ad4f"
  line: "rgba(32, 52, 51, 0.18)"
  carcassonne-table: "#143b32"
  carcassonne-mat: "#173d35"
  carcassonne-paper: "#f4ecd8"
  carcassonne-action: "#335e43"
  carcassonne-action-hover: "#294e37"
  carcassonne-action-ink: "#fff6dc"
typography:
  display:
    fontFamily: '"YLTC Table Serif", "Noto Sans SC Variable", "PingFang SC", sans-serif'
    fontSize: "clamp(1.875rem, 3.1vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: ".015em"
  headline:
    fontFamily: '"YLTC Table Serif", "Noto Sans SC Variable", "PingFang SC", sans-serif'
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: ".01em"
  camel-display:
    fontFamily: '"YLTC Smiley Sans", "Noto Sans SC Variable", "PingFang SC", sans-serif'
    fontWeight: 400
    lineHeight: 1.35
  invitation:
    fontFamily: '"YLTC Table Serif", "Noto Sans SC Variable", "PingFang SC", sans-serif'
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.5
  game-name:
    fontFamily: '"YLTC Table Serif", "Noto Sans SC Variable", "PingFang SC", sans-serif'
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.5
  title:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.375
  body:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: ".8125rem"
    fontWeight: 400
    lineHeight: 1.5
  code:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, "Noto Sans SC Variable", monospace'
rounded:
  sm: ".5rem"
  md: ".625rem"
  lg: ".75rem"
  xl: "1rem"
  2xl: "1rem"
  3xl: "1.5rem"
  full: "9999px"
spacing:
  "1": ".25rem"
  "1.5": ".375rem"
  "2": ".5rem"
  "3": ".75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: ".5rem 1rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  button-ghost:
    rounded: "{rounded.md}"
    height: "2.25rem"
  badge-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: ".125rem .5rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input-entry:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: ".85rem 1rem"
  tabs:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    padding: "3px"
    height: "2.25rem"
  carcassonne-confirm:
    backgroundColor: "{colors.carcassonne-action}"
    textColor: "{colors.carcassonne-action-ink}"
    rounded: "{rounded.md}"
    height: "2.75rem"
  carcassonne-confirm-hover:
    backgroundColor: "{colors.carcassonne-action-hover}"
  carcassonne-map-tool:
    rounded: "{rounded.lg}"
    padding: ".25rem .5rem"
    height: "3rem"
---

# Design System: YLTC Tabletop

## Overview

**Creative North Star: "A warmly lit wooden game table"**

Wood grain, parchment, pine, muted ocean blue and earthen accents establish a familiar place for friends to play. Chinese body text uses one self-hosted sans family; a restrained serif display face and Camel Up’s established Smiley Sans add personality to headings. Crisp geometry and tangible material cues give controls and pieces presence without displacing the game surface.

This document records the implemented shared web system. Each game retains its own renderer, density and visual vocabulary. Carcassonne applies this world through a deep green mat and original miniature SVG relief; its local colors, portrait composition and tile workflow are scoped to that surface. They do not replace Catan's island or draw-guess's canvas presentation.

**Key Characteristics:**

- Natural pigments and light paper against dark tabletop surfaces.
- Shared sans body and controls, with display faces reserved for invitations and game names.
- Material depth connected to pieces, panels and actions.
- Game-owned composition and restrained state feedback.

## Colors

The palette combines pine and ocean pigments with warm paper, terracotta and wheat. Semantic OKLCH tokens and the older material hex tokens coexist in the source; preserve their separate roles rather than converting one into an approximation of the other.

### Primary

- **Deep Pine** (`primary`, `primary-foreground`): shared shadcn primary controls and badges.
- **Table Pine** (`pine`, `pine-soft`): incumbent material controls; the softer shade is their hover state.

### Secondary

- **Warm Paper** (`secondary`, `secondary-foreground`): secondary controls.
- **Muted Ocean** (`ocean`): existing entry-field focus and game-world detail.

### Tertiary

- **Terracotta** (`accent`, `accent-foreground`, `terracotta`): shared interactive hover accents and existing earthen emphasis. The semantic accent and material terracotta are distinct source colors.
- **Wheat** (`wheat`): warm detail and reward language.
- **Destructive** (`destructive`): destructive controls and invalid-field treatment, rather than a new decorative accent.

### Neutral

- **Paper Surfaces** (`background`, `card`, `popover`, `parchment`, `parchment-deep`): distinguish the page, cards, floating surfaces and existing material panels.
- **Deep Ink** (`foreground`, `ink`): body copy and controls; the material and semantic definitions remain distinct.
- **Quiet Ink and Dividers** (`muted`, `muted-foreground`, `border`, `input`, `line`): supporting text, group beds and low-contrast separation.
- **Ocean Focus** (`ring`): visible keyboard focus.

Carcassonne's prefixed tokens belong only to its table, mat, paper panels and primary actions. Its artwork has its own grass, stone, roof and selection colors in `TileArt.tsx` and `Board.tsx`; those are renderer materials, not new platform accents. Seat colors come from `src/lib/player-palette.ts`, shared by SVG pieces and DOM swatches, and must remain separate from semantic action colors.

The homepage and waiting shell extend this world with five scene-local backdrops in `src/components/lobby/presentation.ts`: ocean for Catan, paper purple for drawing, sand brown for camel racing, grass green for Carcassonne and felt green for poker. Their procedural model materials remain local to the selected scene. These values do not replace the shared palette or change live-game colors.

**The Seat Identity Rule.** Reuse the canonical player palette for pieces and swatches; an action color never substitutes for a player's color.

## Typography

**Display Font:** YLTC Table Serif, a local weight-600 Noto Serif SC subset for curated static homepage invitations and game names. Its 23 KB asset, heading inventory, pinned source and license are recorded under `public/fonts`. Camel Up retains local Smiley Sans at weight 400 for its headings and game names.
**Body Font:** Noto Sans SC Variable, loaded from the site's own origin with font-display swap, with PingFang SC and Microsoft YaHei fallbacks. User content always retains this full Chinese family.
**Label/Mono Font:** the same sans for labels; the source mono stack for room codes and numeric utilities.

**Character:** Warm display lettering complements the wooden table. Regular body text, medium labels and semibold functional headings keep the game controls calm and readable. Do not make every line bold or give every game a different body family.

### Hierarchy

- **Display:** homepage headline uses `clamp(1.875rem, 3.1vw, 3rem)` with 1.4 leading; its game invitation uses 2.25rem with 1.5 leading. These are surface-local compositions.
- **Headline:** static game names use the display face; waiting-shell game names grow from 1.125rem to 1.5rem. Camel Up uses its existing Smiley Sans voice.
- **Title:** functional headings and shared dialog titles stay in sans at weight 600, with comfortable leading. Task text and player-provided words stay in the full sans family.
- **Body:** `text-body` is 16px / 1.65, weight 400. Supporting paragraphs may use `text-ui` with relaxed leading.
- **Label:** `text-ui` is 14px / 1.5; buttons and labels use weight 500. Primary game actions may use 600.
- **Caption:** `text-caption` is 13px / 1.5 for supporting information. Dense seat/map annotations may retain local 12px or world-unit sizes; they are not the default body role.
- **Code:** room codes use mono; scores use tabular numerals. Input fields that open a phone keyboard retain at least 16px.

**The Role Rule.** Keep Chinese controls and player content in Noto Sans SC. Limit display faces to static invitations/game names and Camel Up's established heading voice. Extend the heading inventory and regenerate the subset when changing serif display copy. Put element defaults in Tailwind's base layer so component sizes, weights and families work; keep semantic text sizes registered in the class merger.

Catan's terrain, ports, labels and pieces continue to share their world scale. Typography work must not compensate individual map labels in screen pixels. Poker ranks and suit shapes keep their game-specific card scale and red/black distinction.

## Layout

The spacing rhythm follows the existing quarter-rem utility scale, including half steps. Shared cards use generous inner spacing; live controls use tighter gaps. Layouts keep the game surface dominant and move secondary content into compact DOM panels or disclosures. The default page has a minimum width of 320 CSS px.

The homepage places a large miniature exhibit and five-game selection strip beside a constrained entry form from the 1024px large breakpoint. Below that it stacks navigation, exhibit, selection and entry controls. The wrapper is capped at 1560px, uses a small-viewport minimum height and safe-area-aware outer padding. The selection strip remains five columns on phones. Shared dialogs fit inside a two-rem viewport margin, with a wider maximum from the 640px small breakpoint. Do not transplant the homepage composition into a live game.

Waiting rooms share a DOM shell capped at 1480px. From 1024px, preview and membership sit beside a 340px settings column, increasing to 380px at the extra-large breakpoint. Phones stack preview, two-column membership and settings. A fixed paper start footer spans the viewport; bottom content padding and safe-area insets preserve access to the scrollable settings and final seats. The shell passes each game's native preview and settings through without deciding gameplay legality.

Carcassonne uses a full dynamic-viewport-height grid: compact seats, a remaining-height map, then the action dock. Safe-area inset padding is explicit. At the 1024px large breakpoint the dock moves to a 320px right column and outer gaps increase. Its lobby has a separate constrained layout. The map owns pan and pinch; tile geometry, pieces, patterns and previews share the same world transform. Initial map fitting waits for the measured viewport, and later board growth preserves the current view. Current-tile previews grow from 76px to 112px at the desktop breakpoint.

Existing Catan desktop rem scaling is scoped to its live-game layout. It is not a global type enlargement rule for other games. Draw-guess retains its own canvas and reveal layouts. For future responsive acceptance, use the repository's iPhone 16 and Pro Max portrait full-canvas and browser-area cases; DPR does not change CSS dimensions.

**The Game Surface Rule.** Keep map or canvas space primary; apply each game's composition and breakpoints in its own modules.

## Elevation & Depth

Depth mixes tonal layering, translucent borders, soft shadows and small material highlights. Parchment panels float above the table; the map mat is inset. SVG pieces and buildings have lit faces and shaded edges. Carcassonne uses top-left highlights and lower-right relief within its artwork, preserving clear square tile edges and a fixed overhead map.

The homepage exhibit uses actual Three.js geometry, an orthographic camera, warm directional lighting and contact shadows on a wooden plinth. It has one short arrival and subtle mouse response, then renders on demand. Reduced motion settles immediately; hidden or offscreen scenes pause ongoing animation. A size change redraws synchronously in the resize-observer delivery so the cleared drawing buffer does not expose a blank frame. Loading or WebGL failure leaves a static SVG-icon preview while DOM forms remain available. This decorative exhibit never substitutes for the room's authoritative map.

### Shadow Vocabulary

- **Shared panel:** `0 18px 55px rgba(34, 30, 20, 0.2)` from the shared shadow custom property; used by existing entry surfaces and errors.
- **Carcassonne dock:** `0 6px 20px #0d261e40`; separates the light action surface from the dark table.
- **Carcassonne mat:** `inset 0 4px 24px #0b241c80`; a recessed playing area.
- **Carcassonne action:** `0 4px 10px #254a3340`; a soft contact shadow under confirmation controls.

These local shadows are not mandatory replacements for incumbent shared card, Catan or draw-guess shadows. Carcassonne actions use soft elevation; material edge relief belongs to the tile and piece artwork.

Motion describes a state change. Carcassonne uses short easing-out camera/rotation and preview transitions, a single new-tile arrival, a selected-pawn arrival and a score notice; direct dragging disables camera interpolation. Its exact durations/easing are in the sidecar, extracted from `map.css`. Reconnect initializes the current board without replaying old arrivals or scores. Reduced motion removes these transitions and animations, including the pending spinner. Shared effects retain their own game-safe projected event handling.

## Shapes

Shared utility radii derive from the three-quarter-rem base: compact controls use the medium radius, cards the extra-large radius, and badges a pill. The frontmatter keeps both `xl` and `2xl` names because the inline theme and Tailwind scale currently resolve them to the same value; `3xl` is the larger map container corner. Radius values describe the current base, not immutable pixel dimensions under Catan's scoped rem scaling.

Homepage and waiting panels use symmetric rounded paper surfaces; game selectors, fields and local entry controls use compact rounded corners. Legacy asymmetric entry CSS remains in the source but does not describe the current homepage. Carcassonne pairs rounded DOM surfaces with almost-square, slightly beveled SVG tiles. Meeples use their own original curved silhouette and shared seat pigments, with a rotated farmer pose. All map relief scales as part of its geometry.

## Components

### Buttons

Shared buttons are compact and confident: medium-rounded corners, medium-weight label text, inline SVG icons and a standard height of nine spacing units. The size API includes smaller, larger and icon-only variants. Primary uses deep pine; secondary uses warm paper; outline uses a fine border and paper background; ghost removes the resting fill. Outline and ghost hover use the semantic accent. Destructive and link variants retain their specific meanings.

Keyboard focus uses a visible ring with the shared ring color, and disabled controls lose opacity and pointer interaction. Invalid controls use destructive styling. Homepage entry and waiting-room start actions use local green fills, bold text and a minimum height of three rem; they remain surface compositions rather than replacements for the shared button variants.

Carcassonne's turn actions override the primary pigment with its scoped action colors and use at least eleven spacing units in height. Its soft confirmation shadow, pressed displacement, pending text/spinner and retry label communicate state. The task heading begins “轮到你，接上这片风景”; no extra eyebrow line precedes it. Tile selection, optional meeple selection and final confirmation remain distinct steps.

### Chips

Shared badges are small pills with a fine border, tight horizontal padding and caption typography. Primary, secondary, outline, ghost and destructive treatments reuse semantic colors. Interactive badges retain hover and keyboard-focus treatment; a passive badge does not imitate a button.

### Cards / Containers

The shared card uses a paper fill, thin border, soft shadow, extra-large rounding and six-unit section spacing. Header, content and footer provide horizontal inset rather than each child adding an independent frame. Carcassonne's dock and score/region surfaces use its own warm paper and larger composition corners; they remain game-owned.

### Inputs / Fields

The homepage entry field uses a pale paper fill, dark green ink, rounded corners and green border/ring focus. It has a minimum height of three rem; room codes retain the mono stack and increased tracking. Account fields use a compact utility composition with the semantic background and native field behavior. There is no shared Input component today; preserve the existing field contexts instead of documenting an invented primitive.

### Navigation

Shared Radix tabs use a quiet rounded track and a light selected tab with subtle shadow. The line variant uses an active line and no selected shadow. Hover and keyboard focus remain visible. Room/account menus, dialogs and popovers use the owned Radix-based layer for focus, dismissal and keyboard behavior.

### Homepage Exhibit and Waiting Shell

The homepage has five labeled native radio choices with inline SVG icons, a warm-paper selected state and visible keyboard focus. Game selection changes the local miniature scene and backdrop. Original code-built models provide island, drawing notebook, camel track, tile landscape and poker table presentations without raster composition assets.

Waiting previews preserve each game's medium: Catan displays the server-provided SVG map, fitting ports with terrain and retaining zoom, reroll and an optional production-analysis disclosure; its map number appears as ordinary metadata beneath the heading. Drawing uses a static two-dimensional paper presentation; camel racing and Carcassonne use 3D miniatures; poker uses a 3D felt table with an undealt deck. The homepage poker illustration may show decorative cards; the waiting table does not imply a dealt hand.

Membership tiles derive from projected members and core-owned capacity. They show the host, own seat and seated membership, without inventing readiness or per-player connectivity. Empty seats invite sharing the selectable room code, with a plain-HTTP-compatible copy fallback. Each game supplies its own settings hint: Catan and drawing submit host adjustments immediately; poker edits remain local until explicit save and block start while unsaved; camel racing and Carcassonne describe their fixed rules. The fixed footer keeps the game's start action and missing-player count available. Leave confirmations retain owned Radix dialog behavior.

### Carcassonne Map Controls and Miniatures

Map tools sit in grouped paper trays, with a material SVG icon above a short Chinese caption. Their pressed icon scale and one-pixel displacement provide tactile feedback; disabled targets remain visible. The canonical tools are whole-map fit, preview focus, latest-tile focus and zoom. The dock mirrors the selected tile and offers text buttons for follower targets so a small map symbol is never the sole selection affordance. City, road, monastery and field artwork stays original SVG geometry with shared map scaling.

Keyboard focus paints each interactive map feature independently: fields gain an amber fill, roads gain a wider amber surface stroke, and cities gain an amber fill with a stronger pale outline. These treatments supplement the shared SVG focus glow and remain visible on the feature itself. They are renderer-local interaction paint, not platform palette replacements.

## Do's and Don'ts

### Do:

- **Do** reuse semantic tokens for shared UI and the canonical player palette for seat identity.
- **Do** keep Chinese text in the self-hosted Noto Sans SC family and use weight to organize hierarchy.
- **Do** keep game-specific palettes, composition, motion and renderer details inside their game surface.
- **Do** provide visible focus, pending/disabled states and the existing reduced-motion path.
- **Do** keep map artwork and pieces in one scalable world, with text-heavy actions in DOM controls.

### Don't:

- **Don't** apply Carcassonne's green mat, tile geometry or turn dock as a redesign of Catan or draw-guess.
- **Don't** copy official game artwork, logos, rulebook text or proprietary assets.
- **Don't** replay historical rewards or state-change motion after reconnect.
- **Don't** replace owned Radix interaction behavior with hand-built modal or focus logic.
- **Don't** promote legacy eyebrow styling or cramped local captions into a new shared typography rule.

Extraction evidence: `src/styles.css`, `src/components/ui/{button,badge,card,tabs,dialog}.tsx`, `src/components/{Welcome,AccountControl}.tsx`, `src/lib/player-palette.ts`, and `src/games/carcassonne/{CarcassonneTable,TurnDock,Board,TileArt}.tsx` plus `map.css`; direction checked against `../../PRODUCT.md` and `../../docs/carcassonne-design.md`. Existing desktop and portrait review screenshots confirm the implemented composition. This pass records source and rendered appearance; it does not claim new browser, physical-device or iOS Safari acceptance.

The `.impeccable/design.json` sidecar contains source-expanded visual previews and extension metadata. Its synthesized tonal ramps are preview aids, not additional CSS tokens. The frontmatter and current source remain normative. The root ignore rule currently ignores this sidecar along with working review material; retain this exact file explicitly if committing the design documentation.

Not canonized or repaired: the legacy global eyebrow style and the smallest game-local captions are existing craft/density concerns, not instructions for future shared surfaces. This documentation pass does not alter implementation.
