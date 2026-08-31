import type { RoomView } from "@catan/protocol";
import { expect, it } from "vitest";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

it("locks bank visibility to host lobby settings and redacts commands, reads and broadcasts", async () => {
  const registry = new RoomRegistry({ nextSeed: () => 42 });
  const app = await buildApp(registry);
  try {
    const host = registry.createRoom("甲");
    const guest = registry.joinRoom(host.roomId, "乙");
    registry.joinRoom(host.roomId, "丙");
    let room = registry.getRoom(host.roomId, host.seatToken);
    expect(room.settings.bankCountsPublic).toBe(true);
    const settings = { ...room.settings, bankCountsPublic: false };
    const patch = (seatToken: string, expectedRevision: number, bankCountsPublic: unknown = false) => app.inject({
      method: "PATCH", url: `/api/rooms/${host.roomId}/settings`,
      payload: { ...settings, seatToken, expectedRevision, bankCountsPublic },
    });
    expect((await patch(guest.seatToken, room.revision)).json()).toMatchObject({ error: { code: "ONLY_HOST_CAN_CONFIGURE" } });
    expect((await patch(host.seatToken, room.revision - 1)).json()).toMatchObject({ error: { code: "STALE_ROOM_REVISION" } });
    expect((await patch(host.seatToken, room.revision, "false")).statusCode).toBe(400);
    const broadcasts: RoomView[] = [];
    const unsubscribe = registry.subscribe(host.roomId, guest.seatToken, (snapshot) => broadcasts.push(snapshot));
    const changed = await patch(host.seatToken, room.revision);
    expect(changed.statusCode).toBe(200);
    room = changed.json<RoomView>();
    expect(room.settings.bankCountsPublic).toBe(false);
    expect(broadcasts.at(-1)?.settings.bankCountsPublic).toBe(false);

    // Older clients may omit the field; unrelated edits must preserve the choice.
    const oldClientUpdate = await app.inject({ method: "PATCH", url: `/api/rooms/${host.roomId}/settings`, payload: {
      seatToken: host.seatToken, expectedRevision: room.revision, ruleProfile: "base-3-4", playerLimit: 3, victoryPointsToWin: 11,
    } });
    expect(oldClientUpdate.json<RoomView>().settings.bankCountsPublic).toBe(false);
    room = registry.startRoom(host.roomId, host.seatToken);
    expect(room.game?.bankResources).toBeNull();
    expect(broadcasts.at(-1)?.game?.bankResources).toBeNull();
    const read = await app.inject({ method: "GET", url: `/api/rooms/${host.roomId}?seatToken=${guest.seatToken}` });
    expect(read.json<RoomView>().game?.bankResources).toBeNull();
    expect((await patch(host.seatToken, room.revision, true)).json()).toMatchObject({ error: { code: "ROOM_ALREADY_STARTED" } });
    const target = room.game?.interaction.vertexIds[0];
    if (!target || !room.game) throw new Error("Missing setup target");
    const command = registry.executeCommand(host.roomId, host.seatToken, "place", room.game.revision, { type: "PlaceInitialSettlement", vertexId: target });
    expect(command.room.game?.bankResources).toBeNull();
    expect(broadcasts.at(-1)?.game?.bankResources).toBeNull();
    unsubscribe();
  } finally { await app.close(); }
});
