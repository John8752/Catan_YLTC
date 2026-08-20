# Development workflow

This repository uses small, evidence-backed commits so a future human or agent can recover both intent and verification without reconstructing an earlier chat.

## Before implementation

1. Read `PRODUCT.md`, `AGENTS.md` and the relevant rule or ADR documents.
2. Define the visible result and explicit non-goals.
3. Check the worktree and preserve unrelated user changes.
4. For a rule change, write the failing deterministic test before the implementation.

## Commit shape

Use Conventional Commit-style subjects:

```text
<type>(<scope>): <imperative summary>
```

Common types are `feat`, `fix`, `refactor`, `test`, `docs`, `build` and `chore`. Scopes should name a stable domain such as `core`, `protocol`, `server`, `web`, `room` or `setup`.

Milestone, cross-layer and bug-fix commits use this body:

```text
Context:
- Why this change is needed.

Changes:
- The important behavior and boundaries that changed.

Validation:
- pnpm validate
- Browser playtest: exact flow checked
```

The body records decisions and evidence, not a file-by-file inventory that Git already provides.

## Before commit

1. Run the narrowest relevant tests while iterating.
2. Run `pnpm validate` at the delivery point.
3. Inspect `git status --short` for accidental files.
4. Stage only the coherent change.
5. Inspect `git diff --cached --stat` and the staged diff.
6. Commit with accurate validation evidence.

Never commit `node_modules`, `dist`, browser automation output, local databases, logs, secrets or `.env` files.

## Recommended commit boundaries

- Pure refactor with green tests.
- One rule or invariant plus its tests and rule note.
- One protocol/API change plus both producer and consumer updates.
- One player-visible interaction plus its browser verification.
- Documentation-only decision or clarification.

Avoid checkpoint commits that are knowingly broken. If work must be handed off incomplete, document the blocker and remaining steps instead of presenting it as a completed delivery point.
