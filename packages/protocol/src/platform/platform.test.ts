import { expect, it } from "vitest";
import { createDrawGuess } from "@catan/game-core/draw-guess";
import { createPlatformRoomDecoder } from "../platform-stream.js";
import { projectDrawGuess, DEFAULT_DRAW_GUESS_SETTINGS } from "../draw-guess/index.js";
import { GAME_CATALOG,GAME_IDS,getGameDefinition,isGameType,type GameType,type AnyRoomServerMessage } from "./index.js";
it("requires catalog entries for every game and rejects unknown identifiers",()=>{
  expect(GAME_CATALOG.map(g=>g.id)).toEqual([...GAME_IDS]);
  expect(new Set(GAME_CATALOG.map(g=>g.id)).size).toBe(GAME_IDS.length);
  for(const id of GAME_IDS){expect(isGameType(id)).toBe(true);expect(getGameDefinition(id).createLabel).toBeTruthy();}
  for(const id of ["unknown","__proto__","constructor",null])expect(isGameType(id)).toBe(false);
  expect(()=>getGameDefinition("unknown" as GameType)).toThrow("未注册");
});
it("reports an unknown snapshot without decoding it as another game's state",()=>{
  const bad={type:"room_state",room:{gameId:"unknown"}} as unknown as AnyRoomServerMessage;
  expect(createPlatformRoomDecoder()(bad)).toMatchObject({type:"error",code:"UNKNOWN_GAME",message:expect.stringContaining("选择游戏")});
});
it("routes drawing snapshots without requiring a Catan map baseline", () => {
  const state = createDrawGuess("match", ["a", "b", "c"].map((id) => ({ id, name: id })), 4);
  const message: AnyRoomServerMessage = { type: "room_state", room: { id: "ROOM", gameId: "draw-guess", matchId: state.id, revision: 1, hostPlayerId: "a", members: [], settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "a", null) } };
  expect(createPlatformRoomDecoder()(message)).toEqual(message);
  expect(GAME_CATALOG.map((game) => game.id)).toEqual(["catan", "draw-guess", "camel-up", "carcassonne", "texas-holdem"]);
});
