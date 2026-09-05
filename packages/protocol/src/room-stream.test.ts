import { createGame, PLAYER_COLORS, resourceAmounts } from "@catan/game-core";
import { expect, it } from "vitest";
import { createRoomStreamDecoder, createRoomStreamEncoder, MissingRoomMapError } from "./room-stream.js";
import { projectGameForPlayer, type RoomView } from "./views.js";

function room(count: 4 | 6, seed = 42): RoomView {
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i}`, color: PLAYER_COLORS[i]! }));
  const state = createGame({ id: "GAME", seed, players, ruleProfile: count === 4 ? "base-3-4" : "extended-5-6" });
  return { id: "ROOM", revision: 1, hostPlayerId: "p0", members: players.map((p, i) => ({ ...p, isHost: i === 0 })),
    settings: { ruleProfile: count === 4 ? "base-3-4" : "extended-5-6", playerLimit: count, mapSeed: seed, victoryPointsToWin: 10, bankCountsPublic: true },
    previewMap: null, game: projectGameForPlayer(state, "p0"), setupAnalysis: null };
}
function wire<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

for (const count of [4, 6] as const) it(`round-trips all player-safe data, caches topology and still moves the robber (${count})`, () => {
  const initial = wire(room(count)), encode = createRoomStreamEncoder(), decode = createRoomStreamDecoder();
  const first = encode(initial);
  const decoded = decode(wire(first));
  expect(decoded).toEqual({ type: "room_state", room: initial });
  if (decoded.type !== "room_state") throw new Error("Unexpected message");
  const next: RoomView = { ...initial, revision: 2, game: { ...initial.game!, revision: 2,
    map: { ...initial.game!.map, robberHexId: initial.game!.map.hexes.find((h) => h.id !== initial.game!.map.robberHexId)!.id },
    you: { ...initial.game!.you, resources: resourceAmounts({ ore: 7 }) },
  } };
  const update = encode(next);
  expect(update.room.game?.map.geometry).toBeNull();
  expect(JSON.stringify(update).length).toBeLessThan(JSON.stringify(first).length / 2);
  const restored = decode(wire(update));
  expect(restored).toEqual({ type: "room_state", room: next });
  if (restored.type !== "room_state") throw new Error("Unexpected message");
  expect(restored.room.game?.map.hexes).toBe(decoded.room.game?.map.hexes);
  expect(restored.room.game?.players[1]).not.toHaveProperty("resources");
});

it("invalidates on reroll, profile or room changes and requires geometry on a new connection", () => {
  const encode = createRoomStreamEncoder(), decode = createRoomStreamDecoder();
  for (const next of [room(4), room(4, 43), room(6, 43), { ...room(6, 43), id: "OTHER" }]) {
    expect(encode(next).room.game?.map.geometry).not.toBeNull();
    const repeated = encode(next);
    expect(() => decode(repeated)).toThrow(MissingRoomMapError);
    const reconnect = createRoomStreamEncoder()(next);
    expect(decode(reconnect)).toEqual({ type: "room_state", room: next });
  }
});

it("reuses lobby geometry at start, preserves same-game-revision room metadata and passes legacy messages", () => {
  const playing = wire(room(4)), lobby = { ...playing, game: null, previewMap: playing.game!.map };
  const encode = createRoomStreamEncoder(), decode = createRoomStreamDecoder();
  expect(decode(wire(encode(lobby)))).toEqual({ type: "room_state", room: lobby });
  const started = encode(playing);
  expect(started.room.game?.map.geometry).toBeNull();
  expect(decode(wire(started))).toEqual({ type: "room_state", room: playing });
  const analysis: RoomView = { ...playing, revision: 3, setupAnalysis: { status: "failed", sourceRevision: 1, message: "稍后重试" } };
  expect(decode(wire(encode(analysis)))).toEqual({ type: "room_state", room: analysis });
  expect(decode({ type: "room_state", room: playing })).toEqual({ type: "room_state", room: playing });
  expect(decode({ type: "account_session_replaced", message: "已变更" })).toEqual({ type: "account_session_replaced", message: "已变更" });
});
