import type { GameCommand } from "@catan/game-core";
import type { PlayerSessionResponse, PublicSetupAnalysisContent, RoomView } from "@catan/protocol";
import { expect, it, vi } from "vitest";
import type { AiCommentator, PublicSetupAnalysisInput } from "./ai-commentary.js";
import { RoomRegistry } from "./rooms.js";

it("generates one public setup analysis, broadcasts it to every seat, and retains it on reconnect", async () => {
  let resolveAnalysis!: (analysis: PublicSetupAnalysisContent) => void;
  const pending = new Promise<PublicSetupAnalysisContent>((resolve) => { resolveAnalysis = resolve; });
  const analyzeSetup = vi.fn<AiCommentator["analyzeSetup"]>(() => pending);
  const registry = new RoomRegistry({
    nextSeed: () => 404,
    aiCommentator: { analyze: async () => "unused", analyzeSetup },
  });
  const sessions = createStartedRoom(registry);
  const latest = new Map<string, RoomView>();
  const unsubscribes = sessions.map((seat) => registry.subscribe(
    seat.roomId,
    seat.seatToken,
    (room) => latest.set(seat.playerId, room),
  ));

  const finalCommand = completeSetup(registry, sessions);
  expect(analyzeSetup).toHaveBeenCalledTimes(1);
  expect([...latest.values()].every((room) => room.setupAnalysis?.status === "loading")).toBe(true);
  expect([...latest.values()].every((room) => room.game?.phase.kind === "turn")).toBe(true);

  const input = analyzeSetup.mock.calls[0]?.[0];
  if (input === undefined) throw new Error("Missing setup analysis input");
  expect(input.players.every((player) => player.settlements.length === 2)).toBe(true);
  const serializedInput = JSON.stringify(input);
  expect(serializedInput).not.toContain('"resources"');
  expect(serializedInput).not.toContain('"developmentCards"');
  expect(serializedInput).not.toContain("seatToken");

  resolveAnalysis(resultFor(input));
  await vi.waitFor(() => {
    expect([...latest.values()].every((room) => room.setupAnalysis?.status === "ready")).toBe(true);
  });

  const publicResults = [...latest.values()].map((room) => room.setupAnalysis);
  expect(publicResults.every((result) => JSON.stringify(result) === JSON.stringify(publicResults[0]))).toBe(true);
  expect(publicResults[0]).toMatchObject({
    status: "ready",
    predictedWinnerId: input.players[1]?.playerId,
    playerComments: input.players.map((player) => ({ playerId: player.playerId })),
  });

  registry.executeCommand(
    finalCommand.roomId,
    finalCommand.seatToken,
    finalCommand.commandId,
    finalCommand.expectedRevision,
    finalCommand.command,
  );
  expect(analyzeSetup).toHaveBeenCalledTimes(1);

  let reconnected: RoomView | undefined;
  const stopReconnect = registry.subscribe(sessions[0]!.roomId, sessions[0]!.seatToken, (room) => { reconnected = room; });
  expect(reconnected?.setupAnalysis).toEqual(publicResults[0]);

  stopReconnect();
  unsubscribes.forEach((unsubscribe) => unsubscribe());
  registry.dispose();
});

function resultFor(input: PublicSetupAnalysisInput): PublicSetupAnalysisContent {
  const predictedWinner = input.players[1] ?? input.players[0];
  if (predictedWinner === undefined) throw new Error("Missing predicted winner");
  return {
    playerComments: input.players.map((player) => ({
      playerId: player.playerId,
      comment: `${player.name} 的两处选点各有分工。`,
    })),
    predictedWinnerId: predictedWinner.playerId,
    prediction: `${predictedWinner.name} 的公开选点略占优势，但这只是娱乐性预测。`,
  };
}

function createStartedRoom(registry: RoomRegistry): PlayerSessionResponse[] {
  const host = registry.createRoom("林");
  const second = registry.joinRoom(host.roomId, "周");
  const third = registry.joinRoom(host.roomId, "陈");
  registry.startRoom(host.roomId, host.seatToken);
  return [host, second, third];
}

function completeSetup(registry: RoomRegistry, sessions: readonly PlayerSessionResponse[]) {
  const host = sessions[0];
  if (host === undefined) throw new Error("Missing host");
  let commandIndex = 0;
  while (true) {
    const hostView = registry.getRoom(host.roomId, host.seatToken);
    if (hostView.game?.phase.kind !== "setup") throw new Error("Setup finished without a final command");
    const actorId = hostView.game.phase.placementOrder[hostView.game.phase.placementIndex];
    const actor = sessions.find((session) => session.playerId === actorId);
    if (actor === undefined) throw new Error("Missing setup actor");
    const actorGame = registry.getRoom(host.roomId, actor.seatToken).game;
    if (actorGame === null) throw new Error("Missing game");
    const command: GameCommand = actorGame.interaction.kind === "setup-settlement"
      ? { type: "PlaceInitialSettlement", vertexId: actorGame.interaction.vertexIds[0]! }
      : actorGame.interaction.kind === "setup-road"
        ? { type: "PlaceInitialRoad", edgeId: actorGame.interaction.edgeIds[0]! }
        : (() => { throw new Error(`Unexpected interaction ${actorGame.interaction.kind}`); })();
    const commandId = `setup_${commandIndex}`;
    const expectedRevision = actorGame.revision;
    const response = registry.executeCommand(host.roomId, actor.seatToken, commandId, expectedRevision, command);
    if (response.room.game?.phase.kind === "turn") {
      return { roomId: host.roomId, seatToken: actor.seatToken, commandId, expectedRevision, command };
    }
    commandIndex += 1;
  }
}
