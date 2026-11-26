import { expect, it } from "vitest";
import { createCarcassonne, executeCarcassonne } from "@catan/game-core/carcassonne";
import { projectCarcassonne, type CarcassonneRoomView } from "./index.js";
import { createPlatformRoomEncoder, createPlatformRoomDecoder, PLATFORM_ROOM_TRANSPORT, RoomBaselineError } from "../platform-stream.js";
const people = [{ id: "a", name: "甲", color: "pine" as const }, { id: "b", name: "乙", color: "ocean" as const }];
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));
it("round-trips an entire match for both seats and retains unchanged tiles", () => {
  let state = createCarcassonne("match", people, 42), revision = 2, fullBytes = 0, deltaBytes = 0;
  const clients = people.map(p => ({ id: p.id, encode: createPlatformRoomEncoder(PLATFORM_ROOM_TRANSPORT), decode: createPlatformRoomDecoder(), last: null as CarcassonneRoomView | null }));
  for (;;) {
    for (const client of clients) {
      const room: CarcassonneRoomView = { id: "ROOM", gameId: "carcassonne", matchId: "match", revision, members: [], hostPlayerId: "a", game: projectCarcassonne(state, client.id) };
      const message = wire(client.encode(room)), decoded = client.decode(message);
      expect(decoded).toEqual({ type: "room_state", room });
      if (decoded.type !== "room_state" || decoded.room.gameId !== "carcassonne") throw Error();
      if (client.last) expect(decoded.room.game!.board[0]).toBe(client.last.game!.board[0]);
      expect(client.decode(message)).toEqual(decoded);
      client.last = decoded.room;
      fullBytes += JSON.stringify({ type: "room_state", room }).length; deltaBytes += JSON.stringify(message).length;
    }
    if (state.phase.kind === "finished") break;
    const actor = state.phase.playerId, p = projectCarcassonne(state, actor).placements[0]!;
    state = executeCarcassonne(state, actor, { type: "place", matchId: state.id, turn: state.phase.turn, x: p.x, y: p.y, rotation: p.rotation, meeple: p.meepleOptions[0] ?? null }); revision++;
  }
  expect(deltaBytes).toBeLessThan(fullBytes * .55);
});
it("requires exact baselines, resets for new matches and clears removed entities", () => {
  const game = projectCarcassonne(createCarcassonne("m", people, 42), "a");
  const room: CarcassonneRoomView = { id: "R", gameId: "carcassonne", revision: 1, matchId: "m", hostPlayerId: "a", members: [], game };
  const encode = createPlatformRoomEncoder(PLATFORM_ROOM_TRANSPORT), decode = createPlatformRoomDecoder();
  const baseline = wire(encode(room)); decode(baseline);
  const patch = wire(encode({ ...room, revision: 2, game: { ...game, regions: [], meeples: [], scores: [] } }));
  expect(() => createPlatformRoomDecoder()(patch)).toThrow(RoomBaselineError);
  if (patch.type !== "carcassonne_delta") throw Error();
  expect(() => decode({ ...patch, baseRevision: 0 })).toThrow(RoomBaselineError);
  expect(() => decode({ ...patch, viewerId: "b" })).toThrow(RoomBaselineError);
  const next = decode(patch); expect(next.type === "room_state" && next.room.game?.id).toBe("m");
  if (next.type === "room_state" && next.room.gameId === "carcassonne") expect(next.room.game!.regions).toEqual([]);
  const fresh = encode({ ...room, revision: 3, matchId: "new", game: { ...game, id: "new" } });
  expect(fresh.type).toBe("room_state"); expect(() => decode(wire(fresh))).not.toThrow();
});
