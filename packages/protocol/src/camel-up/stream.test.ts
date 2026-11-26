import { expect, it } from "vitest";
import { createCamelUp, executeCamelUp, RACING_CAMELS } from "@catan/game-core/camel-up";
import { projectCamelUp, type CamelRoomView } from "./index.js";
import { createPlatformRoomEncoder, createPlatformRoomDecoder, PLATFORM_ROOM_TRANSPORT } from "../platform-stream.js";
it("splices rolling logs including duplicate text and never exposes opponents' bets", () => {
  const state = createCamelUp("m", ["a", "b", "c"].map(id => ({ id, name: id })), { positions: [1, 2, 3, 1, 2], order: RACING_CAMELS, crazyPositions: [1, 2] });
  const room: CamelRoomView = { id: "R", gameId: "camel-up", matchId: "m", revision: 1, members: [], hostPlayerId: "a", game: { ...projectCamelUp(state, "b"), log: Array.from({ length: 60 }, (_, i) => `line-${i}`) } };
  const encode = createPlatformRoomEncoder(PLATFORM_ROOM_TRANSPORT), decode = createPlatformRoomDecoder();
  const send = (r: CamelRoomView) => decode(JSON.parse(JSON.stringify(encode(r))));
  send(room);
  const next = executeCamelUp(state, "a", { type: "finish-bet", camel: "purple", kind: "winner", matchId: "m", expectedRevision: 0 });
  let current = { ...room, revision: 2, game: { ...projectCamelUp(next, "b"), log: [...room.game!.log.slice(2), "same", "same"] } };
  const patch = encode(current);
  expect(patch.type).toBe("camel_delta");
  if (patch.type !== "camel_delta") throw Error();
  expect(patch.log).toEqual({ drop: 2, append: ["same", "same"] });
  expect(patch.game.ownFinishBets).toBeUndefined(); expect(JSON.stringify(patch.game.effect)).not.toContain("purple");
  expect(decode(JSON.parse(JSON.stringify(patch)))).toEqual({ type: "room_state", room: current });
  for (let i = 0; i < 80; i++) { current = { ...current, revision: current.revision + 1, game: { ...current.game, revision: current.game.revision + 1, log: [...current.game.log.slice(1), "same"] } }; expect(send(current)).toEqual({ type: "room_state", room: current }); }
});
