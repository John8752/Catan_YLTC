import { expect, it, vi } from "vitest";
import { createDrawGuess } from "@catan/game-core/draw-guess";
import { DEFAULT_DRAW_GUESS_SETTINGS, projectDrawGuess, type DrawGuessRoomView } from "@catan/protocol/draw-guess";
import { RoomUpdates } from "./room-updates.js";
import { createGameRoomPolicy } from "./games/room-sync.js";

const session = { roomId: "ROOM", playerId: "a", seatToken: "seat" };
const state = createDrawGuess("MATCH", ["a", "b", "c"].map((id) => ({ id, name: id })), 42);
const room = (revision: number): DrawGuessRoomView => ({
  id: "ROOM", gameId: "draw-guess", matchId: state.id, revision, hostPlayerId: "a", members: [],
  settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "a", null),
});

it("orders drawing snapshots without a Catan history policy and rejects old-seat responses", () => {
  const publish = vi.fn(), updates = new RoomUpdates(session, publish, createGameRoomPolicy);
  expect(updates.accept(room(3), session)).toBe(true);
  expect(updates.gamePolicy).toBeNull();
  expect(updates.accept(room(2), session)).toBe(false);
  expect(updates.accept(room(3), session)).toBe(false);
  const next = { ...session, seatToken: "replacement" };
  updates.reset(next);
  expect(updates.accept(room(9), session)).toBe(false);
  expect(updates.accept(room(4), next)).toBe(true);
  expect(updates.accept({ ...room(5), game: projectDrawGuess(state, "b", null) }, next)).toBe(false);
  expect(publish).toHaveBeenCalledTimes(3);
});

it("rejects a derived update after a newer snapshot or a session reset", () => {
  const updates = new RoomUpdates(session, vi.fn());
  const before = room(1), after = room(2);
  updates.accept(before, session);
  updates.accept(after, session);
  expect(updates.replaceDerived(before, before)).toBe(false);
  expect(updates.replaceDerived(after, { ...after, matchId: "OTHER" })).toBe(false);
  updates.reset(null);
  expect(updates.replaceDerived(after, after)).toBe(false);
});
