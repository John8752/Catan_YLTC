import { createGame, type GameEventRecord } from "@catan/game-core";
import { expect, it } from "vitest";
import { projectGameForPlayer } from "./views.js";
import { HISTORY_PAGE_SIZE, projectHistoryPage, projectHistorySince } from "./history.js";

const base = createGame({ id: "history", seed: 42, players: [
  { id: "p1", name: "甲", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" },
] });
const game = { ...base, revision: 601 };
const records: GameEventRecord[] = Array.from({ length: 600 }, (_, index) => ({
  revision: Math.floor(index / 2) + 2, event: { type: "dice_rolled", playerId: "p1", dice: [1, 2] },
}));
it("pages beyond the legacy cap to the start with stable IDs and complete command revisions", () => {
  const all = projectHistorySince(game, "p1", records, [], 0);
  let page = projectHistoryPage(game, "p1", records, []);
  expect(page.entries).toHaveLength(HISTORY_PAGE_SIZE);
  let entries = [...page.entries];
  while (page.range.afterRevision > 0) {
    const next = projectHistoryPage(game, "p1", records, [], page.range.afterRevision + 1);
    expect(next.range.throughRevision).toBe(page.range.afterRevision);
    entries = [...next.entries, ...entries]; page = next;
  }
  expect(entries).toEqual(all.entries);
  expect(new Set(entries.map((entry) => entry.id)).size).toBe(600);
});
it("keeps large same-revision groups and silent intervals without dropping cursor progress", () => {
  const grouped = records.map((record) => ({ ...record, revision: 600 }));
  expect(projectHistoryPage(game, "p1", grouped, []).entries).toHaveLength(600);
  const silent: GameEventRecord[] = [{ revision: 601, event: { type: "turn_ended", playerId: "p1", nextPlayerId: "p2", turnNumber: 5 } }];
  expect(projectHistorySince(game, "p1", silent, [], 600)).toMatchObject({ entries: [], range: { afterRevision: 600, throughRevision: 601 } });
});
it("redacts every history page for the requesting seat and preserves new-only effects", () => {
  const secret: GameEventRecord = { revision: 601, event: { type: "development_card_bought", playerId: "p1", cardId: "secret", cardType: "victory-point" } };
  const history = [...records, secret];
  expect(projectHistoryPage(game, "p1", history, []).entries.at(-1)?.privateDetail).toContain("胜利点");
  expect(projectHistoryPage(game, "p2", history, []).entries.at(-1)?.privateDetail).toBeNull();
  const initial = projectGameForPlayer(game, "p1", history, null, undefined, [], null);
  expect(initial.effects.filter((effect) => effect.kind !== "action-attention")).toEqual([]);
  const delta = projectGameForPlayer(game, "p1", history, null, undefined, [], 600);
  expect(delta.history).toHaveLength(1);
  expect(delta.effects.every((effect) => effect.kind === "action-attention" || effect.revision > 600)).toBe(true);
});

it("retains older victory warnings in history, ordered after actions from the same revision", () => {
  const warning = { kind: "victory-warning", id: "warning", revision: 200, playerId: "p1", playerName: "甲", publicPoints: 7, targetPoints: 10, tier: 3 } as const;
  const page = projectHistoryPage(game, "p2", records, [warning], 201);
  expect(page.entries.at(-1)).toMatchObject({ id: "w:0000000000000000", revision: 200 });
  expect(page.entries.at(-2)?.revision).toBe(200);
  expect(projectHistorySince(game, "p2", records, [warning], 200).entries.some((entry) => entry.id.startsWith("w:"))).toBe(false);
  const other = { ...warning, id: "a-first-alphabetically", playerId: "p2", playerName: "乙" };
  expect(projectHistoryPage(game, "p2", records, [warning, other], 201).entries.slice(-2).map((entry) => entry.message))
    .toEqual([expect.stringContaining("甲"), expect.stringContaining("乙")]);
});
