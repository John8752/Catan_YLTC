import type { PlayerSessionResponse, RoomView } from "@catan/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("room API", () => {
  it("lets the host configure and reroll the authoritative lobby preview", async () => {
    const seeds = [111, 222];
    const app = await buildApp(new RoomRegistry({ nextSeed: () => seeds.shift() ?? 333 }));
    apps.push(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    });
    const host = createResponse.json<PlayerSessionResponse>();
    expect(host.room.settings).toEqual({
      ruleProfile: "base-3-4",
      playerLimit: 4,
      victoryPointsToWin: 10,
      mapSeed: 111,
    });
    expect(host.room.previewMap?.hexes).toHaveLength(19);

    const settingsResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/settings`,
      payload: {
        seatToken: host.seatToken,
        expectedRevision: host.room.revision,
        playerLimit: 3,
        victoryPointsToWin: 7,
      },
    });
    const configuredRoom = settingsResponse.json<RoomView>();
    expect(settingsResponse.statusCode).toBe(200);
    expect(configuredRoom.settings).toMatchObject({ playerLimit: 3, victoryPointsToWin: 7 });

    const rerollResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/reroll-map`,
      payload: { seatToken: host.seatToken, expectedRevision: configuredRoom.revision },
    });
    const rerolledRoom = rerollResponse.json<RoomView>();
    expect(rerollResponse.statusCode).toBe(200);
    expect(rerolledRoom.settings.mapSeed).toBe(222);
    expect(rerolledRoom.previewMap).not.toEqual(host.room.previewMap);

    const secondResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "周" },
    });
    const second = secondResponse.json<PlayerSessionResponse>();
    const nonHostSettingsResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/settings`,
      payload: {
        seatToken: second.seatToken,
        expectedRevision: second.room.revision,
        playerLimit: 4,
        victoryPointsToWin: 10,
      },
    });
    expect(nonHostSettingsResponse.statusCode).toBe(400);
    expect(nonHostSettingsResponse.json()).toMatchObject({ error: { code: "ONLY_HOST_CAN_CONFIGURE" } });

    await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "陈" },
    });
    const fullResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "赵" },
    });
    expect(fullResponse.statusCode).toBe(400);
    expect(fullResponse.json()).toMatchObject({ error: { code: "ROOM_FULL" } });

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    const startedRoom = startResponse.json<RoomView>();
    expect(startResponse.statusCode).toBe(200);
    expect(startedRoom.previewMap).toBeNull();
    expect(startedRoom.game?.seed).toBe(222);
    expect(startedRoom.game?.map).toEqual(rerolledRoom.previewMap);
    expect(startedRoom.game?.victoryPointsToWin).toBe(7);
  });

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
