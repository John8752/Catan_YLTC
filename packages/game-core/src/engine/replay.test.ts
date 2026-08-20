import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BUILD_COSTS,
  createBaseGame,
  executeGameCommand,
  hasResources,
  legalInitialRoadEdges,
  legalInitialSettlementVertices,
  legalCityVertices,
  legalRoadEdges,
  legalSettlementVertices,
  replayRecordedCommands,
  type EdgeId,
  type GameCommand,
  type GameState,
  type PlayerSeed,
  type RecordedCommand,
  type ResourceType,
  type VertexId,
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

  it("replays a complete legal match to the reviewed digest", () => {
    const initial = createBaseGame({ id: "game_complete_replay", seed: 20260820, players });
    const recorded: RecordedCommand[] = [];
    let state = initial;

    while (state.phase.kind === "setup") {
      const actorId = state.phase.placementOrder[state.phase.placementIndex];
      if (actorId === undefined) throw new Error("Missing setup actor");
      const command: GameCommand = state.phase.step === "settlement"
        ? {
            type: "PlaceInitialSettlement",
            vertexId: chooseSetupVertex(state, actorId),
          }
        : {
            type: "PlaceInitialRoad",
            edgeId: chooseSetupRoad(state, actorId),
          };
      state = recordAndAccept(state, actorId, command, recorded);
    }

    const productionTotals = productiveRolls(state, "player_1");
    expect(productionTotals.resources).toEqual(new Set<ResourceType>(["brick", "lumber", "wool", "grain", "ore"]));
    let rollIndex = 0;

    for (let safety = 0; state.phase.kind !== "finished" && safety < 900; safety += 1) {
      if (state.phase.kind !== "turn") throw new Error("Expected an active turn");
      const actorId = state.phase.activePlayerId;
      if (state.phase.step === "roll") {
        const total = productionTotals.totals[rollIndex % productionTotals.totals.length];
        if (total === undefined) throw new Error("No productive roll available");
        rollIndex += 1;
        state = recordAndAccept(state, actorId, { type: "RollDice" }, recorded, diceRandomValues(total));
        continue;
      }
      if (state.phase.step !== "action") throw new Error(`Unexpected deterministic replay step ${state.phase.step}`);

      if (actorId === "player_1") {
        const build = chooseWinningBuild(state, actorId);
        if (build !== null) {
          state = recordAndAccept(state, actorId, build, recorded);
          continue;
        }
      }
      state = recordAndAccept(state, actorId, { type: "EndTurn" }, recorded);
    }

    expect(state.phase).toEqual({ kind: "finished", winnerId: "player_1" });
    const replayed = replayRecordedCommands(initial, recorded);
    const secondReplay = replayRecordedCommands(initial, recorded);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(secondReplay));
    expect(replayed.state).toEqual(state);
    expect(replayed.events.some((event) => event.type === "game_won")).toBe(true);
    expect(createHash("sha256").update(JSON.stringify(replayed)).digest("hex")).toBe(
      "4423673ed971e975dc34bfaee2d75430129a0f2487bc4252822101ca594420c9",
    );
  });
});

function recordAndAccept(
  state: GameState,
  actorId: string,
  command: GameCommand,
  recorded: RecordedCommand[],
  randomValues?: readonly number[],
): GameState {
  const entry: RecordedCommand = randomValues === undefined
    ? { actorId, command }
    : { actorId, command, randomValues };
  const result = executeGameCommand(state, actorId, command, sequenceRandom(randomValues ?? []));
  if (!result.accepted) throw new Error(`${command.type}: ${result.error.code} ${result.error.message}`);
  recorded.push(entry);
  return result.state;
}

function chooseSetupVertex(state: GameState, actorId: string): VertexId {
  const legal = legalInitialSettlementVertices(state, actorId);
  const ranked = [...legal].sort((left, right) => vertexScore(state, right, actorId) - vertexScore(state, left, actorId));
  const chosen = actorId === "player_1" ? ranked[0] : ranked.at(-1);
  if (chosen === undefined) throw new Error("No legal setup vertex");
  return chosen;
}

function chooseSetupRoad(state: GameState, actorId: string): EdgeId {
  const legal = legalInitialRoadEdges(state, actorId);
  const ranked = [...legal].sort((left, right) => edgeScore(state, right, actorId) - edgeScore(state, left, actorId));
  const chosen = actorId === "player_1" ? ranked[0] : ranked.at(-1);
  if (chosen === undefined) throw new Error("No legal setup road");
  return chosen;
}

function vertexScore(state: GameState, vertexId: VertexId, actorId: string): number {
  const ownedVertices = state.buildings
    .filter((building) => building.ownerId === actorId)
    .map((building) => building.vertexId);
  const vertices = [...ownedVertices, vertexId]
    .map((id) => state.map.vertices.find((vertex) => vertex.id === id))
    .filter((vertex) => vertex !== undefined);
  const hexes = vertices.flatMap((vertex) => vertex.adjacentHexIds)
    .flatMap((id) => {
      const hex = state.map.hexes.find((candidate) => candidate.id === id);
      return hex === undefined || hex.terrain === "desert" ? [] : [hex];
    });
  const resources = new Set(hexes.map((hex) => hex.terrain));
  return resources.size * 1_000 + hexes.reduce((total, hex) => total + pipWeight(hex.numberToken), 0);
}

function edgeScore(state: GameState, edgeId: EdgeId, actorId: string): number {
  const edge = state.map.edges.find((candidate) => candidate.id === edgeId);
  if (edge === undefined) return -1;
  return Math.max(...edge.vertexIds.map((vertexId) => vertexScore(state, vertexId, actorId)));
}

function productiveRolls(state: GameState, playerId: string): { readonly totals: readonly number[]; readonly resources: Set<ResourceType> } {
  const totals = new Set<number>();
  const resources = new Set<ResourceType>();
  for (const building of state.buildings.filter((candidate) => candidate.ownerId === playerId)) {
    const vertex = state.map.vertices.find((candidate) => candidate.id === building.vertexId);
    for (const hexId of vertex?.adjacentHexIds ?? []) {
      const hex = state.map.hexes.find((candidate) => candidate.id === hexId);
      if (hex?.terrain !== undefined && hex.terrain !== "desert" && hex.numberToken !== null) {
        totals.add(hex.numberToken);
        resources.add(hex.terrain);
      }
    }
  }
  return { totals: [...totals].sort((left, right) => left - right), resources };
}

function chooseWinningBuild(state: GameState, actorId: string): GameCommand | null {
  const player = state.players.find((candidate) => candidate.id === actorId);
  if (player === undefined) throw new Error("Missing replay player");
  const city = legalCityVertices(state, actorId)[0];
  if (city !== undefined && player.pieces.cities > 0 && hasResources(player.resources, BUILD_COSTS.city)) {
    return { type: "BuildCity", vertexId: city };
  }
  const settlement = legalSettlementVertices(state, actorId)[0];
  if (settlement !== undefined && player.pieces.settlements > 0 && hasResources(player.resources, BUILD_COSTS.settlement)) {
    return { type: "BuildSettlement", vertexId: settlement };
  }
  if (player.pieces.roads > 0 && hasResources(player.resources, BUILD_COSTS.road)) {
    const road = chooseExpansionRoad(state, actorId);
    if (road !== undefined) return { type: "BuildRoad", edgeId: road };
  }
  return null;
}

function chooseExpansionRoad(state: GameState, actorId: string): EdgeId | undefined {
  const occupiedVertices = new Set(state.buildings.map((building) => building.vertexId));
  const legal = legalRoadEdges(state, actorId);
  return [...legal].sort((left, right) => expansionEdgeScore(state, right, occupiedVertices) - expansionEdgeScore(state, left, occupiedVertices))[0];
}

function expansionEdgeScore(state: GameState, edgeId: EdgeId, occupiedVertices: ReadonlySet<string>): number {
  const edge = state.map.edges.find((candidate) => candidate.id === edgeId);
  if (edge === undefined) return -1;
  return Math.max(...edge.vertexIds.map((vertexId) => {
    const vertex = state.map.vertices.find((candidate) => candidate.id === vertexId);
    if (vertex === undefined || occupiedVertices.has(vertexId)) return 0;
    const respectsDistance = vertex.adjacentVertexIds.every((adjacentId) => !occupiedVertices.has(adjacentId));
    return (respectsDistance ? 100_000 : 0) + vertexScore(state, vertexId, "player_1");
  }));
}

function diceRandomValues(total: number): readonly number[] {
  const first = Math.max(1, total - 6);
  const second = total - first;
  return [(first - 0.5) / 6, (second - 0.5) / 6];
}

function pipWeight(numberToken: number | null): number {
  if (numberToken === null) return 0;
  return 6 - Math.abs(7 - numberToken);
}

function sequenceRandom(values: readonly number[]) {
  let index = 0;
  return { next: () => values[index++] ?? 0 };
}
