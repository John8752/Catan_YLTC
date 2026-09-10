# Documentation index

Current development/testing policy: [Scoped regression](./testing.md) and [ADR-0015](./adr/0015-scoped-regression.md). Read this before selecting checks. Historical milestone/validation records do not require full regression for current changes.

Test ownership/runner migration evidence: [Scoped infrastructure verification](./validation/scoped-testing.md).

Current product areas:

- **Platform**: [Multi-game roadmap and ownership](./multi-game-plan.md), [ADR-0014](./adr/0014-multi-game-rooms.md), [Accounts](./account-system-plan.md), [Deployment](./deployment.md).
- **Catan**: the base/extended rules, first-playable plan, map/HUD/trade/effects and transport validation below.
- **Draw-guess**: [Drawing telephone rules](./rules/draw-guess.md), [Multi-game verification](./validation/multi-game.md).

Draw-guess opening drawings, hints and automatic system-host reveal: [Rules update verification](./validation/draw-guess-opening-reveal.md).

Draw-guess regional/birthday/everyday nouns: [Word-bank research and sources](./draw-guess-word-sources.md). Exact-length guesses and repeatable page reactions follow the current [Draw-guess rules](./rules/draw-guess.md).

Platform/game isolation refactor: [Ownership and validation](./validation/game-isolation.md).

For current work, read product direction, [development workflow](./development-workflow.md), [scoped testing](./testing.md), then the affected game's rule notes and relevant ADRs. Draw-guess work does not require reading historical Catan milestones.

Reference catalog (select by module):

1. [Product direction](../PRODUCT.md)
2. [M0 acceptance](./m0-acceptance.md)
3. [Rules foundation](./rules/foundation.md)
4. [Base 3–4 playable rules](./rules/base-3-4-playable.md)
5. [Extended 5–6 playable rules](./rules/extended-5-6-playable.md)
6. [First playable implementation plan](./first-playable-plan.md)
7. [First playable validation](./validation/first-playable.md)
8. [Risks and open questions](./risks-and-open-questions.md)
9. [Development workflow](./development-workflow.md)
10. [Architecture decisions](./adr/README.md)
11. [Deployment manual](./deployment.md)
12. [Adaptive game surface validation](./validation/adaptive-game-surface.md)
13. [Three-column layout validation](./validation/three-column-layout.md)
14. [Account system implementation plan](./account-system-plan.md)

Rule behavior belongs in `docs/rules`. Long-lived technical decisions belong in `docs/adr`. A feature that changes both should update both in the same change.

Account implementation validation: [Accounts and final settlements](./validation/accounts.md).

Transport optimization validation: [Cached maps and command acknowledgements](./validation/room-transport-phase1.md).

Incremental history validation: [Room events and complete public history](./validation/room-transport-phase2.md).

Roll controls and audio validation: [Mobile actions and distinct game sounds](./validation/roll-actions-and-sounds.md).

Mobile disclosure validation: [Compact controls and negotiation](./validation/mobile-organization.md).

Compact trade editor and queue validation: [Two-row amounts and live queue disclosure](./validation/trade-editor-queue.md).
