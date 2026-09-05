import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer, type GameCommandAck, type RoomView } from "@catan/protocol";
import { afterEach, expect, it, vi } from "vitest";
import { RoomSessionChangedError, RoomUpdates, ROOM_SNAPSHOT_WAIT_MS } from "./room-updates.js";

const session = { roomId: "ROOM", playerId: "p1", seatToken: "seat" };
const game = projectGameForPlayer(createBaseGame({ id: "GAME", seed: 8, players: [
  { id: "p1", name: "甲", color: "ocean" }, { id: "p2", name: "乙", color: "pine" },
] }), "p1");
const room = (revision: number, gameRevision = revision): RoomView => ({ id: "ROOM", revision, hostPlayerId: "p1", members: [], previewMap: null,
  settings: { ruleProfile: "base-3-4", playerLimit: 4, mapSeed: 8, victoryPointsToWin: 10, bankCountsPublic: true },
  game: { ...game, revision: gameRevision }, setupAnalysis: null });
const ack: GameCommandAck = { commandId: "cmd", roomId: "ROOM", roomRevision: 3, gameRevision: 3 };
afterEach(() => vi.useRealTimers());

it("accepts newer room metadata at the same game revision and rejects duplicate/late snapshots", () => {
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  expect(updates.accept(room(3, 2), session)).toBe(true);
  expect(updates.accept(room(4, 2), session)).toBe(true);
  expect(updates.accept(room(3, 2), session)).toBe(false);
  expect(updates.accept(room(4, 2), session)).toBe(false);
  expect(publish).toHaveBeenCalledTimes(2);
});

it("handles push-before-ack and ack-before-push without a second HTTP read", async () => {
  vi.useFakeTimers();
  const read = vi.fn(), updates = new RoomUpdates(session, vi.fn());
  updates.accept(room(3), session);
  await updates.confirm(ack, session, read, true);
  const waiting = updates.confirm({ ...ack, roomRevision: 4, gameRevision: 4 }, session, read, true);
  updates.accept(room(4), session);
  await waiting;
  expect(read).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("reads a complete snapshot when an acknowledged push is missing, but never replays the command", async () => {
  vi.useFakeTimers();
  const read = vi.fn(async () => room(3)), publish = vi.fn(), updates = new RoomUpdates(session, publish);
  const waiting = updates.confirm(ack, session, read, true);
  await vi.advanceTimersByTimeAsync(ROOM_SNAPSHOT_WAIT_MS);
  await waiting;
  expect(read).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledWith(room(3));
  const offline = new RoomUpdates(session, vi.fn());
  await offline.confirm(ack, session, read, false);
  expect(read).toHaveBeenCalledTimes(2);
});

it("does not regress if a newer push arrives while the fallback HTTP request is in flight", async () => {
  let respond!: (room: RoomView) => void;
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  const waiting = updates.confirm(ack, session, () => new Promise((resolve) => { respond = resolve; }), false);
  updates.accept(room(4), session);
  respond(room(3));
  await waiting;
  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledWith(room(4));
});

it("cancels pending acknowledgements and rejects old-seat data after takeover", async () => {
  vi.useFakeTimers();
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  const pending = updates.confirm(ack, session, vi.fn(), true);
  const rejected = expect(pending).rejects.toBeInstanceOf(RoomSessionChangedError);
  const replacement = { ...session, seatToken: "new-seat" };
  updates.reset(replacement);
  await rejected;
  expect(updates.accept(room(9), session)).toBe(false);
  expect(updates.accept(room(1), replacement)).toBe(true);
  expect(updates.accept({ ...room(10), game: { ...game, you: { ...game.you, id: "p2" } } }, replacement)).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("accepts a legacy full response and rejects an insufficient fallback instead of unlocking stale state", async () => {
  const updates = new RoomUpdates(session, vi.fn());
  await updates.confirm({ commandId: "old", room: room(2) }, session, vi.fn(), true);
  await expect(updates.confirm(ack, session, async () => room(2), false)).rejects.toThrow("等待最新状态");
});
