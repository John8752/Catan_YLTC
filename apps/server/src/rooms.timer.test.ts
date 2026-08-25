import type { GameCommand, PlayerSessionResponse, RoomView } from "@catan/protocol";
import { resourceAmounts } from "@catan/game-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomRegistry } from "./rooms.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("authoritative room countdown", () => {
  it("leaves setup untimed, then automatically rolls at the server deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const registry = new RoomRegistry({ nextSeed: () => 202 });
    const sessions = createStartedRoom(registry);
    const host = requireSession(sessions, 0);
    const started = registry.getRoom(host.roomId, host.seatToken);
    const setupRevision = started.game?.revision;

    expect(started.game?.turnTimer).toBeNull();
    vi.advanceTimersByTime(10 * 60_000);
    expect(registry.getRoom(host.roomId, host.seatToken).game?.revision).toBe(setupRevision);

    const readyToRoll = completeSetup(registry, sessions);
    expect(readyToRoll.game?.phase).toMatchObject({ kind: "turn", step: "roll" });
    expect(readyToRoll.game?.turnTimer).toMatchObject({
      kind: "roll",
      playerId: readyToRoll.game?.phase.kind === "turn" ? readyToRoll.game.phase.activePlayerId : "missing",
      durationMs: 5_000,
      deadlineAt: Date.now() + 5_000,
    });
    const rollRevision = readyToRoll.game?.revision;

    vi.advanceTimersByTime(4_999);
    expect(registry.getRoom(host.roomId, host.seatToken).game?.revision).toBe(rollRevision);
    vi.advanceTimersByTime(1);
    const rolled = registry.getRoom(host.roomId, host.seatToken);
    expect(rolled.game?.revision).toBe((rollRevision ?? 0) + 1);
    expect(rolled.game?.lastRoll).not.toBeNull();
    expect(rolled.game?.history.some((entry) => entry.type === "dice_rolled")).toBe(true);
    expect(rolled.game?.phase).toMatchObject({ kind: "turn", step: "action" });
    expect(rolled.game?.turnTimer).toMatchObject({
      kind: "action",
      durationMs: 120_000,
      deadlineAt: Date.now() + 120_000,
    });
    const actionDeadline = rolled.game?.turnTimer?.deadlineAt;
    vi.advanceTimersByTime(30_000);
    const activePlayerId = rolled.game?.phase.kind === "turn" ? rolled.game.phase.activePlayerId : "missing";
    const activeSession = sessions.find((session) => session.playerId === activePlayerId);
    if (activeSession === undefined || rolled.game === null) throw new Error("Missing active timer session");
    const afterOffer = registry.executeCommand(
      host.roomId,
      activeSession.seatToken,
      "timer_offer",
      rolled.game.revision,
      {
        type: "OpenTradeOffer",
        offerId: "timer_offer",
        give: resourceAmounts({}),
        receive: resourceAmounts({ ore: 1 }),
      },
    ).room;
    expect(afterOffer.game?.turnTimer?.deadlineAt).toBe(actionDeadline);
    const actionRevision = afterOffer.game?.revision;

    vi.advanceTimersByTime(89_999);
    expect(registry.getRoom(host.roomId, host.seatToken).game?.revision).toBe(actionRevision);
    vi.advanceTimersByTime(1);
    const ended = registry.getRoom(host.roomId, host.seatToken);
    expect(ended.game?.revision).toBe((actionRevision ?? 0) + 1);
    expect(ended.game?.phase).toMatchObject({ kind: "turn", step: "roll", turnNumber: 2 });
    expect(ended.game?.history.at(-1)?.type).toBe("turn_ended");
    expect(ended.game?.turnTimer).toMatchObject({ kind: "roll", durationMs: 5_000 });

    registry.dispose();
  });
});

function createStartedRoom(registry: RoomRegistry): PlayerSessionResponse[] {
  const host = registry.createRoom("林");
  const second = registry.joinRoom(host.roomId, "周");
  const third = registry.joinRoom(host.roomId, "陈");
  registry.startRoom(host.roomId, host.seatToken);
  return [host, second, third];
}

function completeSetup(registry: RoomRegistry, sessions: readonly PlayerSessionResponse[]): RoomView {
  const host = requireSession(sessions, 0);
  let commandIndex = 0;
  while (true) {
    const hostView = registry.getRoom(host.roomId, host.seatToken);
    if (hostView.game?.phase.kind !== "setup") return hostView;
    const actorId = hostView.game.phase.placementOrder[hostView.game.phase.placementIndex];
    const actor = sessions.find((session) => session.playerId === actorId);
    if (actor === undefined) throw new Error("Missing setup actor session");
    const actorView = registry.getRoom(host.roomId, actor.seatToken);
    const game = actorView.game;
    if (game === null) throw new Error("Missing setup game");
    const command: GameCommand = game.interaction.kind === "setup-settlement"
      ? { type: "PlaceInitialSettlement", vertexId: requireFirst(game.interaction.vertexIds) }
      : game.interaction.kind === "setup-road"
        ? { type: "PlaceInitialRoad", edgeId: requireFirst(game.interaction.edgeIds) }
        : (() => { throw new Error(`Unexpected setup interaction ${game.interaction.kind}`); })();
    registry.executeCommand(host.roomId, actor.seatToken, `setup_${commandIndex}`, game.revision, command);
    commandIndex += 1;
  }
}

function requireSession(sessions: readonly PlayerSessionResponse[], index: number): PlayerSessionResponse {
  const session = sessions[index];
  if (session === undefined) throw new Error(`Missing session ${index}`);
  return session;
}

function requireFirst<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("Missing legal setup target");
  return item;
}
