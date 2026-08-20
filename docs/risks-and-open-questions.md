# Risks and open questions

## Settled M0 decisions

| ID | Decision | Result |
|---|---|---|
| D1 | Renderer | React + responsive SVG board + DOM HUD |
| D2 | Authority | Server-authoritative rooms and rules |
| D3 | First complete profile | 3–4 player base rules |
| D4 | Randomness | Explicit seeded source; no ambient randomness in the core |
| D5 | Identity | Anonymous room-scoped player identity for the first release |

## Open questions

| ID | Question | Needed by |
|---|---|---|
| O1 | Exact two-player variant and neutral-player behavior | two-player milestone |
| O2 | Exact 5–6 paired-turn interpretation | extended profile milestone |
| O3 | Reconnection grace period and abandoned-seat policy | M1 |
| O4 | Whether chat is in-product or external | trading UX milestone |
| O5 | Public release name and rights review | public deployment |

## Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | UI becomes the source of rule truth | Keep all legality in `game-core` and test it headlessly |
| R2 | Private cards leak over WebSocket | Centralize projections in `packages/protocol` and test redaction |
| R3 | Reconnect creates divergent state | Use revisions, snapshots and recorded commands/events |
| R4 | Player-count variants become nested conditionals | Use explicit `RuleProfile` modules |
| R5 | Vibe coding produces giant files | Enforce the code map and split near 500 lines |
| R6 | Map, resources, building and trade collapse into one rules blob | Enforce ADR-0004 domain boundaries and compose them only in named rulesets |
