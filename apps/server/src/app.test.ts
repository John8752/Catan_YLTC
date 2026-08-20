import type { PlayerSessionResponse, RoomView } from "@catan/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("room API", () => {
  it("creates, joins and starts a three-player room", async () => {
    const app = await buildApp();
    apps.push(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    });
    const host = createResponse.json<PlayerSessionResponse>();

    expect(createResponse.statusCode).toBe(201);
    expect(host.room.members).toHaveLength(1);
    expect(host.seatToken).not.toBe(host.playerId);
    expect(JSON.stringify(host.room)).not.toContain(host.seatToken);

    const publicIdAuth = await app.inject({
      method: "GET",
      url: `/api/rooms/${host.roomId}?seatToken=${encodeURIComponent(host.playerId)}`,
    });
    expect(publicIdAuth.statusCode).toBe(400);
    expect(publicIdAuth.json()).toMatchObject({ error: { code: "PLAYER_NOT_FOUND" } });

    for (const playerName of ["周", "陈"]) {
      const joinResponse = await app.inject({
        method: "POST",
        url: `/api/rooms/${host.roomId}/join`,
        payload: { playerName },
      });

      expect(joinResponse.statusCode).toBe(200);
    }

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    const room = startResponse.json<RoomView>();

    expect(startResponse.statusCode).toBe(200);
    expect(room.game?.map.hexes).toHaveLength(19);
    expect(room.game?.phase.kind).toBe("setup");

    const vertexId = room.game?.interaction.vertexIds[0];
    const expectedRevision = room.game?.revision;
    if (vertexId === undefined || expectedRevision === undefined) {
      throw new Error("Host has no initial placement target");
    }
    const commandPayload = {
      seatToken: host.seatToken,
      commandId: "command_setup_1",
      expectedRevision,
      command: { type: "PlaceInitialSettlement", vertexId },
    };
    const commandResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/commands`,
      payload: commandPayload,
    });
    const commandRoom = commandResponse.json<{ room: RoomView }>().room;

    expect(commandResponse.statusCode).toBe(200);
    expect(commandRoom.game?.buildings).toHaveLength(1);
    expect(commandRoom.game?.interaction.kind).toBe("setup-road");
    expect(commandRoom.game?.history.at(-1)?.type).toBe("initial_settlement_placed");

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/commands`,
      payload: commandPayload,
    });
    expect(duplicateResponse.statusCode).toBe(200);
    expect(duplicateResponse.json<{ room: RoomView }>().room.game?.buildings).toHaveLength(1);

    const staleResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/commands`,
      payload: { ...commandPayload, commandId: "command_setup_stale" },
    });
    expect(staleResponse.statusCode).toBe(400);
    expect(staleResponse.json()).toMatchObject({ error: { code: "STALE_REVISION" } });
  });

  it("prevents a room from starting with fewer than three players", async () => {
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    });
    const host = createResponse.json<PlayerSessionResponse>();
    const startResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });

    expect(startResponse.statusCode).toBe(400);
    expect(startResponse.json()).toMatchObject({
      error: { code: "NOT_ENOUGH_PLAYERS" },
    });
  });
});
