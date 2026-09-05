import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer, type GameHistoryPage, type RoomView } from "@catan/protocol";
import { expect, it, vi } from "vitest";
import { HistoryBuffer } from "./history-buffer.js";
import { RoomUpdates, RoomSessionChangedError } from "./room-updates.js";

const page = (afterRevision: number, throughRevision: number): GameHistoryPage => ({ gameId: "GAME", range: { afterRevision, throughRevision },
  entries: Array.from({ length: throughRevision - afterRevision }, (_, i) => ({ id: `e:${String(i + afterRevision + 1).padStart(16, "0")}`, revision: i + afterRevision + 1, type: "test", message: `记录 ${i + afterRevision + 1}`, privateDetail: null })) });
const session = { roomId: "ROOM", playerId: "p1", seatToken: "token" };
const game = projectGameForPlayer(createBaseGame({ id: "GAME", seed: 8, players: [{ id: "p1", name: "甲", color: "pine" }, { id: "p2", name: "乙", color: "ocean" }] }), "p1");
const room = (data: GameHistoryPage): RoomView => ({ id: "ROOM", revision: data.range.throughRevision, hostPlayerId: "p1", members: [], previewMap: null, setupAnalysis: null,
  settings: { ruleProfile: "base-3-4", playerLimit: 4, mapSeed: 8, victoryPointsToWin: 10, bankCountsPublic: true },
  game: { ...game, revision: data.range.throughRevision, history: data.entries, historyRange: data.range } });

it("merges overlapping, empty and gapped intervals without duplicate rows or a visible hole", () => {
  const buffer = new HistoryBuffer();
  buffer.add(page(0, 5)); buffer.add(page(3, 6));
  expect(buffer.latest!.entries).toHaveLength(6);
  buffer.add(page(10, 15)); expect(buffer.hasGap).toBe(true);
  expect(buffer.latest!.entries).toHaveLength(5);
  buffer.add(page(5, 10)); expect(buffer.hasGap).toBe(false);
  expect(buffer.latest!.entries).toEqual(page(0, 15).entries);
  buffer.add({ ...page(15, 16), entries: [] });
  expect(buffer.latest!.range.throughRevision).toBe(16);
});
it("an older page racing a new push extends history without replacing dynamic state or effects", async () => {
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  updates.accept(room(page(50, 100)), session);
  let resolve!: (page: GameHistoryPage) => void;
  const pending = updates.loadEarlierHistory(session, () => new Promise((done) => { resolve = done; }));
  const live = room(page(100, 101));
  updates.accept(live, session);
  resolve(page(0, 50)); await pending;
  const latest = publish.mock.lastCall![0] as RoomView;
  expect(latest.revision).toBe(101); expect(latest.game!.history).toHaveLength(101);
  expect(latest.game!.effects).toBe(live.game!.effects);
  expect(updates.accept(room(page(50, 100)), session)).toBe(false);
});
it("recovers a reconnect gap to previously read history and rejects a replaced seat's pending page", async () => {
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  updates.accept(room(page(0, 50)), session);
  updates.accept(room(page(100, 150)), session);
  expect(updates.hasHistoryGap).toBe(true);
  expect(publish.mock.lastCall![0].game.history).toHaveLength(50); // Keep the reader's old rows until the gap is filled.
  expect(publish.mock.lastCall![0].game.history[0].revision).toBe(1);
  await updates.loadEarlierHistory(session, async (_game, before) => { expect(before).toBe(101); return page(50, 100); });
  expect(updates.hasHistoryGap).toBe(false);
  expect(publish.mock.lastCall![0].game.history).toHaveLength(150);
  updates.accept(room(page(200, 250)), session);
  let resolve!: (page: GameHistoryPage) => void;
  const pending = updates.loadEarlierHistory(session, () => new Promise((done) => { resolve = done; }));
  updates.reset({ ...session, seatToken: "new" });
  resolve(page(150, 200)); await expect(pending).rejects.toBeInstanceOf(RoomSessionChangedError);
  expect(publish.mock.lastCall![0]).toBeNull();
});
