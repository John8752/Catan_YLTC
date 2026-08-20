import { describe, expect, it } from "vitest";
import {
  createBaseGame,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  replayRecordedCommands,
  type PlayerSeed,
  type RecordedCommand,
} from "../index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("recorded command replay", () => {
  it("reproduces byte-stable state and event history", () => {
    const initial = createBaseGame({ id: "game_replay", seed: 808, players });
    const commands: RecordedCommand[] = [];
    let state = initial;

    while (state.phase.kind === "setup") {
      const actorId = state.phase.placementOrder[state.phase.placementIndex];
      if (actorId === undefined) throw new Error("Missing actor");
      const command = state.phase.step === "settlement"
        ? { type: "PlaceInitialSettlement" as const, vertexId: legalInitialSettlementVertices(state, actorId)[0] ?? "" }
        : { type: "PlaceInitialRoad" as const, edgeId: legalInitialRoadEdges(state, actorId)[0] ?? "" };
      commands.push({ actorId, command });
      state = replayRecordedCommands(initial, commands).state;
    }
    commands.push({ actorId: "player_1", command: { type: "RollDice" }, randomValues: [0, 0] });
    commands.push({ actorId: "player_1", command: { type: "EndTurn" } });

    const first = replayRecordedCommands(initial, commands);
    const second = replayRecordedCommands(initial, commands);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.state.phase).toMatchObject({ kind: "turn", activePlayerId: "player_2" });
  });
});
