import type { GameCommandAck, GameCommandResponse } from "@catan/protocol";
import { expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

it("acknowledges without building an extra private projection, preserves idempotency and legacy full replies", async () => {
  const registry = new RoomRegistry({ nextSeed: () => 42 }), app = await buildApp(registry);
  try {
    const host = registry.createRoom("甲"); registry.joinRoom(host.roomId, "乙");
    const started = registry.startRoom(host.roomId, host.seatToken);
    const vertexId = started.game!.interaction.vertexIds[0]!;
    const project = vi.spyOn(registry as unknown as { projectRoom: (...args: unknown[]) => unknown }, "projectRoom");
    const payload = { seatToken: host.seatToken, commandId: "one", expectedRevision: started.game!.revision,
      responseMode: "ack", command: { type: "PlaceInitialSettlement", vertexId } };
    const response = await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload });
    expect(response.statusCode, response.body).toBe(200);
    expect(project).not.toHaveBeenCalled(); // No subscribers in this case; ACK itself must not project.
    const ack = response.json<GameCommandAck>();
    expect(ack).toEqual({ commandId: "one", roomId: host.roomId, roomRevision: started.revision + 1, gameRevision: started.game!.revision + 1 });
    expect(Buffer.byteLength(response.body)).toBeLessThan(200);
    const retry = await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload });
    expect(retry.json()).toEqual(ack);
    expect(registry.getRoom(host.roomId, host.seatToken).game!.buildings).toHaveLength(1);
    const legacy = await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload: { ...payload, responseMode: undefined } });
    expect(legacy.json<GameCommandResponse>().room.game?.revision).toBe(ack.gameRevision);
    const stale = await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload: { ...payload, commandId: "other" } });
    expect(stale.json()).toMatchObject({ error: { code: "STALE_REVISION" } });
  } finally { await app.close(); }
});
