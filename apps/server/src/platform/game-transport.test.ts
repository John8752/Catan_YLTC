import { expect, it } from "vitest";
import { RoomRegistry } from "../rooms.js";
import { buildApp } from "../app.js";
import type { AnyRoomView } from "@catan/protocol/platform";
import { PLATFORM_ROOM_TRANSPORT, createPlatformRoomDecoder, type PlatformWireMessage } from "@catan/protocol/transport";

for (const gameId of ["camel-up", "carcassonne", "texas-holdem"] as const) it(`${gameId} sends safe pushes and small idempotent ACKs`, async () => {
  const registry = new RoomRegistry({ nextSeed: () => 42 }), app = await buildApp(registry);
  const host = registry.createRoom("甲", null, gameId), seats = [host, registry.joinRoom(host.roomId, "乙"), registry.joinRoom(host.roomId, "丙")];
  registry.startRoom(host.roomId, host.seatToken); await app.ready();
  const clients: { socket: Awaited<ReturnType<typeof app.injectWS>>; frames: PlatformWireMessage[]; views: AnyRoomView[] }[] = [];
  try {
    for (const seat of seats) {
      const frames: PlatformWireMessage[] = [], views: AnyRoomView[] = [], decode = createPlatformRoomDecoder();
      const socket = await app.injectWS(`/ws?roomId=${host.roomId}&seatToken=${seat.seatToken}&transport=${PLATFORM_ROOM_TRANSPORT}`, {}, { onInit(ws) { ws.on("message", (data: unknown) => { const frame = JSON.parse(String(data)) as PlatformWireMessage; frames.push(frame); const decoded = decode(frame); if (decoded.type === "room_state") views.push(decoded.room); }); } });
      clients.push({ socket, frames, views });
    }
    await expect.poll(() => clients.every(c => c.views.length === 1)).toBe(true);
    const room = registry.getRoom(host.roomId, host.seatToken);
    let actorId: string, command: unknown;
    switch (room.gameId) {
      case "camel-up": actorId = room.game!.phase.kind === "racing" ? room.game!.phase.activePlayerId : ""; command = { type: "finish-bet", camel: "purple", kind: "winner", matchId: room.matchId, expectedRevision: room.game!.revision }; break;
      case "carcassonne": {
        const game = room.game!, p = game.placements[0]!; actorId = game.phase.kind === "turn" ? game.phase.playerId : "";
        command = { type: "place", matchId: room.matchId, turn: game.phase.kind === "turn" ? game.phase.turn : 0, x: p.x, y: p.y, rotation: p.rotation, meeple: p.meepleOptions[0] ?? null }; break;
      }
      case "texas-holdem": actorId = room.game!.phase.kind === "betting" ? room.game!.phase.actorId : ""; command = { matchId: room.matchId, expectedRevision: room.game!.revision, handNumber: room.game!.handNumber, action: { type: "call" } }; break;
      default: throw Error("Unexpected test game");
    }
    const actor = seats.find(s => s.playerId === actorId)!, payload = { seatToken: actor.seatToken, commandId: "once", command }, url = `/api/rooms/${host.roomId}/${gameId}/commands`;
    const response = await app.inject({ method: "POST", url, payload });
    expect(response.statusCode).toBe(200); const ack = response.json();
    expect(ack).toMatchObject({ type: "command_ack", commandId: "once", gameId, matchId: room.matchId });
    expect(ack).not.toHaveProperty("game"); expect(response.body.length).toBeLessThan(350);
    await expect.poll(() => clients.every(c => c.views.length === 2)).toBe(true);
    for (const [i, client] of clients.entries()) {
      expect(client.frames[1]!.type).toBe(gameId === "carcassonne" ? "carcassonne_delta" : gameId === "camel-up" ? "camel_delta" : "room_state");
      const authoritative = registry.getRoom(host.roomId, seats[i]!.seatToken), actual = client.views.at(-1)!;
      // Poker clock sampling is allowed to advance between these projections.
      if (actual.gameId === "texas-holdem" && authoritative.gameId === "texas-holdem" && actual.game!.deadline && authoritative.game!.deadline) actual.game!.deadline.serverNow = authoritative.game!.deadline.serverNow;
      expect(actual).toEqual(authoritative);
      for (const seat of seats) expect(JSON.stringify(client.frames)).not.toContain(seat.seatToken);
      if (actual.gameId === "camel-up" && seats[i]!.playerId !== actorId) { expect(actual.game!.ownFinishBets).toEqual([]); expect(JSON.stringify(actual.game!.effect)).not.toContain("purple"); }
    }
    const retry = await app.inject({ method: "POST", url, payload }); expect(retry.json()).toEqual(ack);
    expect(clients.every(c => c.frames.length === 2)).toBe(true);
  } finally { clients.forEach(c => c.socket.terminate()); await app.close(); }
});
