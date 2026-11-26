import { afterEach, expect, it, vi } from "vitest";
import { createCamelUp, RACING_CAMELS } from "@catan/game-core/camel-up";
import { projectCamelUp, type CamelRoomView } from "@catan/protocol/camel-up";
import type { RoomCommandAck } from "@catan/protocol/platform";
import { RoomUpdates, RoomSessionChangedError } from "../room-updates.js";
import { confirmRoomCommand } from "./command-confirmation.js";
const session = { roomId: "R", playerId: "a", seatToken: "secret" };
const state = createCamelUp("m", ["a", "b", "c"].map(id => ({ id, name: id })), { positions: [1, 2, 3, 1, 2], order: RACING_CAMELS, crazyPositions: [1, 2] });
function fixture() {
  const publish = vi.fn(), updates = new RoomUpdates(session, publish);
  const room: CamelRoomView = { id: "R", gameId: "camel-up", matchId: "m", revision: 1, members: [], hostPlayerId: "a", game: projectCamelUp(state, "a") };
  const next = { ...room, revision: 2, game: { ...room.game!, revision: 1 } };
  const ack: RoomCommandAck = { type: "command_ack", commandId: "c", roomId: "R", gameId: "camel-up", matchId: "m", roomRevision: 2, gameRevision: 1 };
  const read = vi.fn(async (): Promise<CamelRoomView> => next), options = { commandId: "c", gameId: "camel-up" as const, matchId: "m", connected: true, read };
  updates.accept(room, session); return { updates, room, next, ack, read, options, publish };
}
afterEach(() => vi.useRealTimers());
it("accepts push before ACK and ACK before push without extra reads", async () => {
  const f = fixture(); f.updates.accept(f.next, session);
  await confirmRoomCommand(f.updates, session, f.ack, f.options); expect(f.read).not.toHaveBeenCalled();
  const g = fixture(), waiting = confirmRoomCommand(g.updates, session, g.ack, g.options);
  g.updates.accept(g.next, session); await waiting; expect(g.read).not.toHaveBeenCalled();
});
it("recovers a lost push by reading once, never overwrites a newer push", async () => {
  vi.useFakeTimers(); const f = fixture();
  let finish!: (r: CamelRoomView) => void; f.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const waiting = confirmRoomCommand(f.updates, session, f.ack, f.options);
  await vi.advanceTimersByTimeAsync(1500); expect(f.read).toHaveBeenCalledTimes(1);
  const newer = { ...f.next, revision: 3, game: { ...f.next.game, revision: 2 } }; f.updates.accept(newer, session);
  finish(f.next); await waiting; expect(f.updates.snapshot).toBe(newer);
});
it("isolates replaced credentials and new matches during the wait/read", async () => {
  const f = fixture(), waiting = confirmRoomCommand(f.updates, session, f.ack, f.options);
  f.updates.reset({ ...session, seatToken: "new" }); await expect(waiting).rejects.toBeInstanceOf(RoomSessionChangedError); expect(f.read).not.toHaveBeenCalled();
  const g = fixture(), other = confirmRoomCommand(g.updates, session, g.ack, g.options);
  g.updates.accept({ ...g.next, revision: 3, matchId: "new", game: { ...g.next.game, id: "new" } }, session);
  await expect(other).rejects.toBeInstanceOf(RoomSessionChangedError);
});
it("rejects wrong confirmations and stale recovery", async () => {
  const f = fixture();
  await expect(confirmRoomCommand(f.updates, session, { ...f.ack, commandId: "other" }, f.options)).rejects.toThrow("不匹配");
  const g = fixture(); g.read.mockResolvedValue(g.room);
  await expect(confirmRoomCommand(g.updates, session, g.ack, { ...g.options, connected: false })).rejects.toThrow("操作已提交");
});
