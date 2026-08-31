import { RESOURCE_TYPES, resourceAmounts } from "@catan/game-core";
import type { GameCommand, GameView, RoomView } from "@catan/protocol";
import { expect, it } from "vitest";
import { RoomRegistry } from "./rooms.js";

it("broadcasts a real scoring milestone, retains it on reconnect and deduplicates command retries", () => {
  const registry = new RoomRegistry({ nextSeed: () => 42, now: () => 0 });
  try {
    const host = registry.createRoom("林");
    const seats = [host, registry.joinRoom(host.roomId, "周"), registry.joinRoom(host.roomId, "陈")];
    const lobby = registry.getRoom(host.roomId, host.seatToken);
    registry.updateSettings(host.roomId, host.seatToken, lobby.revision, { ...lobby.settings, victoryPointsToWin: 6 });
    registry.startRoom(host.roomId, host.seatToken);
    const latest = new Map<string, RoomView>();
    const unsubscribes = seats.map((seat) => registry.subscribe(host.roomId, seat.seatToken, (room) => latest.set(seat.playerId, room)));

    // Play through the real seeded engine, choosing only server-projected legal
    // commands. No test backdoor or manufactured canonical scores are needed.
    let found = false;
    for (let index = 0; index < 600; index += 1) {
      const views = seats.map((seat) => ({ seat, game: registry.getRoom(host.roomId, seat.seatToken).game! }));
      const actor = views.find(({ game }) => game.interaction.kind !== "waiting");
      if (actor === undefined) throw new Error("No actionable seat");
      const command = nextCommand(actor.game);
      const commandId = `milestone-${index}`;
      const response = registry.executeCommand(host.roomId, actor.seat.seatToken, commandId, actor.game.revision, command).room;
      const warning = response.game?.effects.find((effect) => effect.kind === "victory-warning");
      if (warning === undefined) continue;
      expect(warning).toMatchObject({ publicPoints: 3, targetPoints: 6, tier: 3 });
      for (const seat of seats) {
        expect(latest.get(seat.playerId)?.game?.effects).toContainEqual(warning);
        expect(registry.getRoom(host.roomId, seat.seatToken).game?.history.filter((entry) => entry.type === "victory-warning")).toHaveLength(1);
      }
      const retry = registry.executeCommand(host.roomId, actor.seat.seatToken, commandId, actor.game.revision, command).room;
      expect(retry.game?.history).toEqual(response.game?.history);
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      let reconnected: RoomView | undefined;
      const stop = registry.subscribe(host.roomId, host.seatToken, (room) => { reconnected = room; });
      expect(reconnected?.game?.effects).toContainEqual(warning);
      stop();
      found = true;
      break;
    }
    expect(found).toBe(true);
  } finally { registry.dispose(); }
});

function nextCommand(game: GameView): GameCommand {
  const interaction = game.interaction;
  switch (interaction.kind) {
    case "setup-settlement": {
      const score = (vertexId: string) => game.map.hexes.filter((hex) => hex.vertexIds.includes(vertexId))
        .reduce((sum, hex) => sum + (hex.terrain === "ore" || hex.terrain === "grain" ? 10 : 1), 0);
      return { type: "PlaceInitialSettlement", vertexId: [...interaction.vertexIds].sort((a, b) => score(b) - score(a))[0]! };
    }
    case "setup-road": return { type: "PlaceInitialRoad", edgeId: interaction.edgeIds[0]! };
    case "turn-roll": return { type: "RollDice" };
    case "discard": {
      const resources = resourceAmounts({});
      let remaining = interaction.requiredCount;
      for (const resource of RESOURCE_TYPES) {
        const count = Math.min(remaining, game.you.resources[resource]);
        resources[resource] = count;
        remaining -= count;
      }
      return { type: "DiscardResources", resources };
    }
    case "robber": {
      const target = interaction.targets.find((target) => game.map.hexes.find((hex) => hex.id === target.hexId)?.terrain === "desert") ?? interaction.targets[0]!;
      return { type: "MoveRobber", hexId: target.hexId, victimId: target.victimIds[0] ?? null };
    }
    case "turn-action":
      if (interaction.cityVertexIds[0]) return { type: "BuildCity", vertexId: interaction.cityVertexIds[0] };
      if (interaction.settlementVertexIds[0]) return { type: "BuildSettlement", vertexId: interaction.settlementVertexIds[0] };
      return { type: "EndTurn" };
    default: throw new Error(`Unexpected interaction ${interaction.kind}`);
  }
}
