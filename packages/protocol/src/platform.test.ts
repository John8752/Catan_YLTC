import { expect, it } from "vitest";
import { createDrawGuess } from "@catan/game-core/draw-guess";
import { createPlatformRoomDecoder } from "./platform-stream.js";
import { projectDrawGuess, DEFAULT_DRAW_GUESS_SETTINGS } from "./draw-guess/index.js";
import { GAME_CATALOG, type AnyRoomServerMessage } from "./platform.js";
it("routes drawing snapshots without requiring a Catan map baseline", () => {
  const state = createDrawGuess("match", ["a", "b", "c"].map((id) => ({ id, name: id })), 4);
  const message: AnyRoomServerMessage = { type: "room_state", room: { id: "ROOM", gameId: "draw-guess", matchId: state.id, revision: 1, hostPlayerId: "a", members: [], settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "a", null) } };
  expect(createPlatformRoomDecoder()(message)).toEqual(message);
  expect(GAME_CATALOG.map((game) => game.id)).toEqual(["catan", "draw-guess"]);
});
