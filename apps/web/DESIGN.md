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
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "clamp(2.5rem, 4vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-.015em"
  headline:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.015em"
  title:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: ".875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    fontSize: ".75rem"
    fontWeight: 500
    lineHeight: "1rem"
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

Wood grain, parchment, pine, muted ocean blue and earthen accents establish a familiar place for friends to play. Chinese typography stays in one self-hosted family; weight and space carry hierarchy. Crisp geometry and tangible material cues give controls and pieces presence without displacing the game surface.

This document records the implemented shared web system. Each game retains its own renderer, density and visual vocabulary. Carcassonne applies this world through a deep green mat and original miniature SVG relief; its local colors, portrait composition and tile workflow are scoped to that surface. They do not replace Catan's island or draw-guess's canvas presentation.

**Key Characteristics:**

- Natural pigments and light paper against dark tabletop surfaces.
- One Chinese type family with compact, readable DOM controls.
- Material depth connected to pieces, panels and actions.
- Game-owned composition and restrained state feedback.

## Colors

The palette combines pine and ocean pigments with warm paper, terracotta and wheat. Semantic OKLCH tokens and the older material hex tokens coexist in the source; preserve their separate roles rather than converting one into an approximation of the other.

### Primary

- **Deep Pine** (`primary`, `primary-foreground`): shared shadcn primary controls and badges.
- **Table Pine** (`pine`, `pine-soft`): legacy entry controls and the welcome backdrop; the softer shade is their hover state.

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

**The Seat Identity Rule.** Reuse the canonical player palette for pieces and swatches; an action color never substitutes for a player's color.

## Typography

**Display Font:** Noto Sans SC Variable with PingFang SC, Microsoft YaHei and system sans fallbacks.
**Body Font:** the same family, loaded from the site's own origin with font-display swap.
**Label/Mono Font:** the same sans for labels; the source mono stack for room codes and numeric utilities.

**Character:** Clear contemporary Chinese lettering anchors the material setting. Hierarchy comes from scale, weight and density rather than a separate display face.

### Hierarchy

- **Display:** the welcome headline role; its desktop clamp is captured above. Existing welcome CSS changes it below its own breakpoints; this is not a universal in-game heading size.
- **Headline:** the Carcassonne lobby headline role, with tight leading.
- **Title:** shared dialog titles, semibold and compact. In-game task headings use bold body-to-title sizes appropriate to their dock.
- **Body:** the default document text role. Supporting paragraphs often use the label size with relaxed leading; the welcome lead uses a larger size and generous line-height.
- **Label:** shared buttons, tabs, descriptions and compact information.
- **Caption:** badges and supporting text. Carcassonne also has smaller seat/tool captions; these local density choices do not establish a new shared minimum or type role.
- **Code:** room codes use the mono stack; scores use tabular numerals where implemented.

**The One Family Rule.** Use Noto Sans SC for Chinese headings, controls and board labels; reserve the mono stack for code-like identifiers and numeric utilities.

## Layout

The spacing rhythm follows the existing quarter-rem utility scale, including half steps. Shared cards use generous inner spacing; live controls use tighter gaps. Layouts keep the game surface dominant and move secondary content into compact DOM panels or disclosures. The default page has a minimum width of 320 CSS px.

The welcome screen uses an asymmetric two-column composition, a constrained entry form and fluid outer padding; at its existing 820px breakpoint it stacks. Shared dialogs fit inside a two-rem viewport margin, with a wider maximum from the 640px small breakpoint. Do not transplant the welcome composition into a game.

Carcassonne uses a full dynamic-viewport-height grid: compact seats, a remaining-height map, then the action dock. Safe-area inset padding is explicit. At the 1024px large breakpoint the dock moves to a 320px right column and outer gaps increase. Its lobby has a separate constrained layout. The map owns pan and pinch; tile geometry, pieces, patterns and previews share the same world transform. Initial map fitting waits for the measured viewport, and later board growth preserves the current view. Current-tile previews grow from 76px to 112px at the desktop breakpoint.

Existing Catan desktop rem scaling is scoped to its live-game layout. It is not a global type enlargement rule for other games. Draw-guess retains its own canvas and reveal layouts. For future responsive acceptance, use the repository's iPhone 16 and Pro Max portrait full-canvas and browser-area cases; DPR does not change CSS dimensions.

**The Game Surface Rule.** Keep map or canvas space primary; apply each game's composition and breakpoints in its own modules.

## Elevation & Depth

Depth mixes tonal layering, translucent borders, soft shadows and small material highlights. Parchment panels float above the table; the map mat is inset. SVG pieces and buildings have lit faces and shaded edges. Carcassonne uses top-left highlights and lower-right relief within its artwork, preserving clear square tile edges and a fixed overhead map.

### Shadow Vocabulary

- **Shared panel:** `0 18px 55px rgba(34, 30, 20, 0.2)` from the shared shadow custom property; used by existing entry surfaces and errors.
- **Carcassonne dock:** `0 6px 20px #0d261e40`; separates the light action surface from the dark table.
- **Carcassonne mat:** `inset 0 4px 24px #0b241c80`; a recessed playing area.
- **Carcassonne action:** `0 4px 10px #254a3340`; a soft contact shadow under confirmation controls.

These local shadows are not mandatory replacements for incumbent shared card, Catan or draw-guess shadows. Carcassonne actions use soft elevation; material edge relief belongs to the tile and piece artwork.

Motion describes a state change. Carcassonne uses short easing-out camera/rotation and preview transitions, a single new-tile arrival, a selected-pawn arrival and a score notice; direct dragging disables camera interpolation. Its exact durations/easing are in the sidecar, extracted from `map.css`. Reconnect initializes the current board without replaying old arrivals or scores. Reduced motion removes these transitions and animations, including the pending spinner. Shared effects retain their own game-safe projected event handling.

## Shapes

Shared utility radii derive from the three-quarter-rem base: compact controls use the medium radius, cards the extra-large radius, and badges a pill. The frontmatter keeps both `xl` and `2xl` names because the inline theme and Tailwind scale currently resolve them to the same value; `3xl` is the larger map container corner. Radius values describe the current base, not immutable pixel dimensions under Catan's scoped rem scaling.

The legacy entry panel has an asymmetric corner and an inset border. Preserve it where it exists; it is not a template for every panel. Carcassonne pairs rounded DOM surfaces with almost-square, slightly beveled SVG tiles. Meeples use their own original curved silhouette and shared seat pigments, with a rotated farmer pose. All map relief scales as part of its geometry.

## Components

### Buttons

Shared buttons are compact and confident: medium-rounded corners, medium-weight label text, inline SVG icons and a standard height of nine spacing units. The size API includes smaller, larger and icon-only variants. Primary uses deep pine; secondary uses warm paper; outline uses a fine border and paper background; ghost removes the resting fill. Outline and ghost hover use the semantic accent. Destructive and link variants retain their specific meanings.

Keyboard focus uses a visible ring with the shared ring color, and disabled controls lose opacity and pointer interaction. Invalid controls use destructive styling. The legacy entry button is larger and heavier; it remains an incumbent entry composition, not the default new shared button.

Carcassonne's turn actions override the primary pigment with its scoped action colors and use at least eleven spacing units in height. Its soft confirmation shadow, pressed displacement, pending text/spinner and retry label communicate state. The task heading begins “轮到你，接上这片风景”; no extra eyebrow line precedes it. Tile selection, optional meeple selection and final confirmation remain distinct steps.

### Chips

Shared badges are small pills with a fine border, tight horizontal padding and caption typography. Primary, secondary, outline, ghost and destructive treatments reuse semantic colors. Interactive badges retain hover and keyboard-focus treatment; a passive badge does not imitate a button.

### Cards / Containers

The shared card uses a paper fill, thin border, soft shadow, extra-large rounding and six-unit section spacing. Header, content and footer provide horizontal inset rather than each child adding an independent frame. Carcassonne's dock and score/region surfaces use its own warm paper and larger composition corners; they remain game-owned.

### Inputs / Fields

The welcome entry field uses a translucent light fill, material ink, medium rounding and ocean border/glow focus. Account fields use a compact utility composition with the semantic background and native field behavior. There is no shared Input component today; preserve the existing field contexts instead of documenting an invented primitive.

### Navigation

Shared Radix tabs use a quiet rounded track and a light selected tab with subtle shadow. The line variant uses an active line and no selected shadow. Hover and keyboard focus remain visible. Room/account menus, dialogs and popovers use the owned Radix-based layer for focus, dismissal and keyboard behavior.

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
