# ADR-0017: Carcassonne real-time 3D miniatures

- Status: accepted
- Date: 2026-11-25

## Context

The user rejected Carcassonne's SVG relief map and explicitly requested real 3D, referencing the Camel Up development chat. That implementation was inspected read-only in its separate checkout. Carcassonne remains isolated in its own worktree and game module.

## Decision

Carcassonne uses a lazily loaded Three.js WebGL2 renderer inside the existing React/Tailwind/shadcn application. Original geometric tiles, extruded city surfaces, battlement walls, buildings, groves and wooden followers receive actual lighting and shadows. An orthographic camera preserves scale while allowing angled and overhead views. This is a Carcassonne-specific exception to ADR-0003's renderer choice, not a replacement of ADR-0005's frontend stack. Catan retains SVG; drawing retains Canvas 2D.

DOM buttons remain responsible for text, accessible placement targets, follower choices, camera controls and region listings. Overview targets cluster until projected tile edges reach 52px; activating a cluster focuses its area before selecting a legal placement. Raycasting inspects actual visible terrain. Placement and follower choices come exclusively from the protocol projection; meshes and visual paths never decide legality, connectivity, scoring or state. The server remains authoritative.

Single-pointer dragging pans, two-pointer gestures pan/zoom, and explicit controls rotate the view or switch overhead. A movement threshold and multi-pointer cancellation prevent dragging from selecting a tile. Keyboard users can choose projected placement buttons, inspect the region list, pan with arrow keys and zoom with plus/minus. Map growth preserves the current camera. Focus and rotation animate with a reduced-motion path; reconnect does not replay old tile arrivals.

WebGL initialization failure and context loss switch to the existing SVG compatibility renderer without changing the editable turn. Three.js is owned only by `apps/web`. Materials and geometries are disposed on replacement/unmount, static meshes batch by feature/material, rendering occurs only on changes or finite transitions, and pixel ratio is capped at 1.6. No secure-context-only API is introduced.

## Validation

Carcassonne browser tests must explicitly assert a live WebGL2 scene and rendered board count, cover actual canvas picking/camera interaction, and separately exercise unavailable WebGL and real context loss. Portrait acceptance uses the repository's iPhone 16/Pro Max full-canvas and browser-area cases, plus long horizontal/vertical maps, safe-area resizing, reduced motion and a complete multiplayer match. Chromium device emulation is not physical iOS Safari validation.
