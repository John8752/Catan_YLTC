# Documentation index

Read documents in this order:

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
