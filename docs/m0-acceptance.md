# M0 acceptance

M0 is complete when:

- the workspace installs from the committed lockfile;
- `pnpm validate` passes;
- the same seed always produces the same board;
- the standard board contains 19 land hexes with the intended terrain counts;
- three players can create/join a room and the host can start it;
- all connected clients receive a new revision after room changes;
- each client sees their own resource hand but only resource counts for opponents;
- the browser renders the shared board as responsive SVG;
- the UI remains usable at a 390 px viewport width;
- M1 persistence and full-rule work is recorded rather than hidden inside M0.

## Validation record

Validated locally on 2026-08-19:

- `pnpm validate` passed with 9 automated tests;
- three independent browser sessions created, joined and started one room;
- every session received seed `592446217` and the same 19-hex board during the playtest;
- a refreshed tab recovered its room-scoped identity from tab-scoped session storage;
- a second tab opened at the same origin started without inheriting the first tab's player identity;
- desktop and 390×844 responsive screenshots were reviewed;
- the clean browser session reported no console errors or warnings.

The screenshots are local QA artifacts under the ignored `output/playwright` directory. They are evidence, not shipped assets.
