# ADR-0003: React and SVG renderer

- Status: Accepted
- Date: 2026-08-19

## Decision

Use React for the application and a responsive SVG for the hex board. Use ordinary DOM for lobby controls, player status, trading UI, dialogs and history.

## Reason

The board is a small set of crisp interactive shapes rather than a sprite-heavy action scene. SVG provides direct pointer targets, responsive geometry, accessibility hooks and testable markup without coupling rules to a canvas engine.
