import type { GameCommand } from "@catan/game-core";
import type { PlayerSessionResponse } from "@catan/protocol";
import { afterEach, expect, it, vi } from "vitest";
import type { AiCommentator } from "./ai-commentary.js";
import { buildTableIntentInput, resolveTableIntent } from "./ai-intent.js";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

it("offers every seat reachable sites without leaking a single private card", () => {
  const { registry, sessions } = tableInTurnOne();
  const host = sessions[0];
  if (host === undefined) throw new Error("Missing host");

  const input = buildTableIntentInput(registry.getRoom(host.roomId, host.seatToken));

  expect(input.players).toHaveLength(3);
  expect(input.players.every((player) => player.prospects.length > 0)).toBe(true);
  expect(input.players.every((player) => player.prospects.every((spot) => spot.roadsNeeded <= 3))).toBe(true);
  // Production is the only honest route to "what they still need", because the
  // hands themselves never reach this builder.
  expect(input.players.every((player) => Object.values(player.production).some((pips) => pips > 0))).toBe(true);

  const serialized = JSON.stringify(input);
  expect(serialized).not.toContain('"resources"');
  expect(serialized).not.toContain('"developmentCards"');
  expect(serialized).not.toContain("seatToken");
});

it("keeps our own road distance and refuses to highlight a site it never offered", () => {
  const { registry, sessions } = tableInTurnOne();
  const host = sessions[0];
  if (host === undefined) throw new Error("Missing host");
  const input = buildTableIntentInput(registry.getRoom(host.roomId, host.seatToken));

  const offered = input.players[0]?.prospects[0];
  if (offered === undefined) throw new Error("Missing offered prospect");
  const content = resolveTableIntent(input, JSON.stringify({
    overview: "三个人都在往同一片麦地挤。",
    players: input.players.map((player, index) => ({
      playerKey: player.playerKey,
      // Only the first answer names a real site; the rest are invented.
      targetVertexId: index === 0 ? offered.vertexId : "V-does-not-exist",
      intent: "想抢那块麦地",
      blocker: "路还差一截",
    })),
  }));

  expect(content.players[0]).toMatchObject({
    targetVertexId: offered.vertexId,
    roadsNeeded: offered.roadsNeeded,
  });
  expect(content.players.slice(1).every((player) => player.targetVertexId === null)).toBe(true);
  expect(content.players.slice(1).every((player) => player.roadsNeeded === null)).toBe(true);
  expect(content.players.every((player) => player.intent === "想抢那块麦地")).toBe(true);
});

it("rejects a reading that does not cover every seat exactly once", () => {
  const { registry, sessions } = tableInTurnOne();
  const host = sessions[0];
  if (host === undefined) throw new Error("Missing host");
  const input = buildTableIntentInput(registry.getRoom(host.roomId, host.seatToken));

  expect(() => resolveTableIntent(input, JSON.stringify({
    overview: "只说了一个人。",
    players: [{ playerKey: "P1", targetVertexId: null, intent: "想扩张", blocker: "缺砖" }],
  }))).toThrow();
});

it("rations the read to one per turn per seat and answers only the seat that asked", async () => {
  const { registry, sessions } = tableInTurnOne();
  const host = sessions[0];
  const guest = sessions[1];
  if (host === undefined || guest === undefined) throw new Error("Missing seats");

  const analyzeIntent = vi.fn<AiCommentator["analyzeIntent"]>(async (input) => ({
    overview: "大家都在往中间挤。",
    players: input.players.map((player) => ({
      playerId: player.playerId,
      targetVertexId: player.prospects[0]?.vertexId ?? null,
      roadsNeeded: player.prospects[0]?.roadsNeeded ?? null,
      intent: "想往高点数那边走",
      blocker: "路还不够",
    })),
  }));
  const app = await buildApp(registry, {
    aiCommentator: { analyze: async () => "unused", analyzeSetup: unusedSetupAnalysis, analyzeIntent },
  });
  apps.push(app);

  const read = (seat: PlayerSessionResponse) => app.inject({
    method: "POST",
    url: `/api/rooms/${seat.roomId}/ai-commentary`,
    payload: {
      seatToken: seat.seatToken,
      expectedRevision: registry.getRoom(seat.roomId, seat.seatToken).game?.revision,
      mode: "intent",
    },
  });

  const first = await read(host);
  expect(first.statusCode).toBe(200);
  expect(first.json()).toMatchObject({
    mode: "intent",
    content: "大家都在往中间挤。",
    intent: { overview: "大家都在往中间挤。" },
  });
  expect(first.json().intent.players).toHaveLength(3);

  const again = await read(host);
  expect(again.statusCode).toBe(429);
  expect(again.json()).toMatchObject({ error: { code: "AI_INTENT_TURN_SPENT" } });
  expect(analyzeIntent).toHaveBeenCalledTimes(1);

  // The allowance is per seat, and the answer never enters shared room state.
  expect((await read(guest)).statusCode).toBe(200);
  expect(analyzeIntent).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(registry.getRoom(host.roomId, host.seatToken))).not.toContain("想往高点数那边走");
});

it("does not spend the turn's read when the model fails", async () => {
  const { registry, sessions } = tableInTurnOne();
  const host = sessions[0];
  if (host === undefined) throw new Error("Missing host");

  const analyzeIntent = vi.fn<AiCommentator["analyzeIntent"]>()
    .mockRejectedValueOnce(new Error("upstream is having a day"))
    .mockResolvedValueOnce({ overview: "重来一次就好了。", players: [] });
  const app = await buildApp(registry, {
    aiCommentator: { analyze: async () => "unused", analyzeSetup: unusedSetupAnalysis, analyzeIntent },
  });
  apps.push(app);

  const read = () => app.inject({
    method: "POST",
    url: `/api/rooms/${host.roomId}/ai-commentary`,
    payload: {
      seatToken: host.seatToken,
      expectedRevision: registry.getRoom(host.roomId, host.seatToken).game?.revision,
      mode: "intent",
    },
  });

  expect((await read()).statusCode).toBe(500);
  expect((await read()).statusCode).toBe(200);
});

function tableInTurnOne() {
  const registry = new RoomRegistry({ nextSeed: () => 404 });
  const host = registry.createRoom("林");
  const second = registry.joinRoom(host.roomId, "周");
  const third = registry.joinRoom(host.roomId, "陈");
  registry.startRoom(host.roomId, host.seatToken);
  const sessions = [host, second, third];

  let commandIndex = 0;
  while (true) {
    const hostView = registry.getRoom(host.roomId, host.seatToken);
    if (hostView.game?.phase.kind !== "setup") break;
    const actorId = hostView.game.phase.placementOrder[hostView.game.phase.placementIndex];
    const actor = sessions.find((session) => session.playerId === actorId);
    if (actor === undefined) throw new Error("Missing setup actor");
    const actorGame = registry.getRoom(host.roomId, actor.seatToken).game;
    if (actorGame === null) throw new Error("Missing game");
    const command: GameCommand = actorGame.interaction.kind === "setup-settlement"
      ? { type: "PlaceInitialSettlement", vertexId: actorGame.interaction.vertexIds[0] ?? "" }
      : { type: "PlaceInitialRoad", edgeId: actorGame.interaction.edgeIds[0] ?? "" };
    registry.executeCommand(host.roomId, actor.seatToken, `setup_${commandIndex}`, actorGame.revision, command);
    commandIndex += 1;
  }

  return { registry, sessions };
}

async function unusedSetupAnalysis() {
  return { playerComments: [], predictedWinnerId: "unused", prediction: "unused" };
}
