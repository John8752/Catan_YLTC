import type { PlayerSessionResponse, RoomView } from "@catan/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("room API", () => {
  it("releases lobby seats, transfers host ownership and deletes an empty room", async () => {
    const app = await buildApp();
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<PlayerSessionResponse>();
    const second = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "周" },
    })).json<PlayerSessionResponse>();
    const third = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "陈" },
    })).json<PlayerSessionResponse>();

    const secondLeave = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: second.seatToken },
    });
    expect(secondLeave.statusCode).toBe(200);
    expect(secondLeave.json()).toEqual({ roomDeleted: false, newHostPlayerId: host.playerId });

    const replacement = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "赵" },
    })).json<PlayerSessionResponse>();
    expect(replacement.room.members.find((member) => member.id === replacement.playerId)?.color).toBe("ocean");

    const hostLeave = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: host.seatToken },
    });
    expect(hostLeave.json()).toEqual({ roomDeleted: false, newHostPlayerId: third.playerId });
    const promotedRoom = (await app.inject({
      method: "GET",
      url: `/api/rooms/${host.roomId}?seatToken=${encodeURIComponent(third.seatToken)}`,
    })).json<RoomView>();
    expect(promotedRoom.hostPlayerId).toBe(third.playerId);
    expect(promotedRoom.members.find((member) => member.id === third.playerId)?.isHost).toBe(true);

    await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: replacement.seatToken },
    });
    const finalLeave = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: third.seatToken },
    });
    expect(finalLeave.json()).toEqual({ roomDeleted: true, newHostPlayerId: null });
    const deletedRoom = await app.inject({
      method: "GET",
      url: `/api/rooms/${host.roomId}?seatToken=${encodeURIComponent(third.seatToken)}`,
    });
    expect(deletedRoom.statusCode).toBe(404);
  });

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
      bankCountsPublic: true,
    });
    expect(host.room.previewMap?.hexes).toHaveLength(19);

    const settingsResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/settings`,
      payload: {
        seatToken: host.seatToken,
        expectedRevision: host.room.revision,
        ruleProfile: "base-3-4",
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
        ruleProfile: "base-3-4",
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

    const startedLeaveResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: host.seatToken },
    });
    expect(startedLeaveResponse.statusCode).toBe(400);
    expect(startedLeaveResponse.json()).toMatchObject({
      error: { code: "CANNOT_LEAVE_STARTED_GAME" },
    });

    const vertexId = room.game?.interaction.vertexIds[0];
    const expectedRevision = room.game?.revision;
    if (vertexId === undefined || expectedRevision === undefined) {
      throw new Error("Host has no initial placement target");
    }
    const counterSchemaResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/commands`,
      payload: {
        seatToken: host.seatToken,
        commandId: "command_counter_schema",
        expectedRevision,
        command: {
          type: "CounterTradeOffer",
          offerId: "offer_schema",
          proposerGives: { brick: 1, lumber: 0, wool: 0, grain: 0, ore: 0 },
          proposerReceives: { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 1 },
        },
      },
    });
    expect(counterSchemaResponse.statusCode).toBe(400);
    expect(counterSchemaResponse.json()).toMatchObject({ error: { code: "WRONG_PHASE" } });

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

  it("answers a retried command from live state instead of a stored snapshot", async () => {
    const app = await buildApp(new RoomRegistry({ nextSeed: () => 202 }));
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<PlayerSessionResponse>();
    for (const playerName of ["周", "陈"]) {
      await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/join`, payload: { playerName } });
    }
    const started = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    })).json<RoomView>();

    const settle = async (commandId: string, revision: number, vertexId: string) =>
      app.inject({
        method: "POST",
        url: `/api/rooms/${host.roomId}/commands`,
        payload: {
          seatToken: host.seatToken,
          commandId,
          expectedRevision: revision,
          command: { type: "PlaceInitialSettlement", vertexId },
        },
      });

    const vertexId = started.game?.interaction.vertexIds[0];
    const revision = started.game?.revision;
    if (vertexId === undefined || revision === undefined) throw new Error("No placement target");

    const first = await settle("command_a", revision, vertexId);
    expect(first.statusCode).toBe(200);

    // Place the road that follows, so the room has moved on from the command above.
    const afterSettlement = first.json<{ room: RoomView }>().room;
    const edgeId = afterSettlement.game?.interaction.edgeIds[0];
    const roadRevision = afterSettlement.game?.revision;
    if (edgeId === undefined || roadRevision === undefined) throw new Error("No road target");
    const afterRoad = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/commands`,
      payload: {
        seatToken: host.seatToken,
        commandId: "command_b",
        expectedRevision: roadRevision,
        command: { type: "PlaceInitialRoad", edgeId },
      },
    })).json<{ room: RoomView }>().room;

    // Retrying the first command must not replay it, and must not answer with the
    // room as it looked back then -- storing that snapshot per command is what made
    // memory grow with the square of the number of moves.
    const retry = await settle("command_a", revision, vertexId);
    const retried = retry.json<{ room: RoomView }>().room;

    expect(retry.statusCode).toBe(200);
    expect(retried.game?.buildings).toHaveLength(1);
    expect(retried.game?.roads).toHaveLength(1);
    expect(retried.game?.revision).toBe(afterRoad.game?.revision);
  });

  it("creates and starts a five-player extended room on the 30-hex map", async () => {
    const app = await buildApp();
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "一" },
    })).json<PlayerSessionResponse>();

    const settingsResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/settings`,
      payload: {
        seatToken: host.seatToken,
        expectedRevision: host.room.revision,
        ruleProfile: "extended-5-6",
        playerLimit: 6,
        victoryPointsToWin: 10,
      },
    });
    const configured = settingsResponse.json<RoomView>();
    expect(settingsResponse.statusCode).toBe(200);
    expect(configured.settings.ruleProfile).toBe("extended-5-6");
    expect(configured.previewMap?.hexes).toHaveLength(30);

    for (const playerName of ["二", "三", "四", "五"]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/rooms/${host.roomId}/join`,
        payload: { playerName },
      });
      expect(response.statusCode).toBe(200);
    }

    const startResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    const started = startResponse.json<RoomView>();
    expect(startResponse.statusCode).toBe(200);
    expect(started.game?.ruleProfile).toBe("extended-5-6");
    expect(started.game?.map.hexes).toHaveLength(30);
    expect(started.game?.developmentDeckCount).toBe(34);
  });

  it("evicts abandoned rooms but keeps rooms that still have a live subscriber", async () => {
    let now = 1_000_000;
    const registry = new RoomRegistry({ now: () => now });
    const app = await buildApp(registry, { idleRoomTtlMs: 60_000 });
    apps.push(app);

    const abandoned = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<PlayerSessionResponse>();
    const watched = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "周" },
    })).json<PlayerSessionResponse>();
    registry.subscribe(watched.roomId, watched.seatToken, () => {});

    now += 59_000;
    expect(registry.evictIdleRooms(60_000)).toEqual([]);

    now += 2_000;
    expect(registry.evictIdleRooms(60_000)).toEqual([abandoned.roomId]);
    expect(registry.roomCount).toBe(1);

    const gone = await app.inject({
      method: "GET",
      url: `/api/rooms/${abandoned.roomId}?seatToken=${encodeURIComponent(abandoned.seatToken)}`,
    });
    expect(gone.statusCode).toBe(404);

    const alive = await app.inject({
      method: "GET",
      url: `/api/rooms/${watched.roomId}?seatToken=${encodeURIComponent(watched.seatToken)}`,
    });
    expect(alive.statusCode).toBe(200);
  });

  it("runs the eviction sweep on its own interval", async () => {
    let now = 1_000_000;
    const registry = new RoomRegistry({ now: () => now });
    const app = await buildApp(registry, { idleRoomTtlMs: 50, roomSweepIntervalMs: 10 });
    apps.push(app);

    await app.inject({ method: "POST", url: "/api/rooms", payload: { playerName: "林" } });
    expect(registry.roomCount).toBe(1);

    now += 1_000;
    await vi.waitFor(() => expect(registry.roomCount).toBe(0));
  });

  it("rate limits room creation and answers with the shared error shape", async () => {
    const app = await buildApp(new RoomRegistry(), { roomCreationsPerMinute: 2 });
    apps.push(app);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accepted = await app.inject({
        method: "POST",
        url: "/api/rooms",
        payload: { playerName: "林" },
      });
      expect(accepted.statusCode).toBe(201);
    }

    const rejected = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json()).toEqual({
      error: { code: "TOO_MANY_REQUESTS", message: "Too many rooms created; wait a moment" },
    });
  });

  it("keeps a separate room-creation budget per client behind the proxy", async () => {
    const app = await buildApp(new RoomRegistry(), {
      roomCreationsPerMinute: 1,
      trustProxy: "127.0.0.1",
    });
    apps.push(app);

    const first = await app.inject({
      method: "POST",
      url: "/api/rooms",
      headers: { "x-forwarded-for": "203.0.113.1" },
      payload: { playerName: "林" },
    });
    const otherClient = await app.inject({
      method: "POST",
      url: "/api/rooms",
      headers: { "x-forwarded-for": "203.0.113.2" },
      payload: { playerName: "周" },
    });
    const sameClientAgain = await app.inject({
      method: "POST",
      url: "/api/rooms",
      headers: { "x-forwarded-for": "203.0.113.1" },
      payload: { playerName: "陈" },
    });

    expect(first.statusCode).toBe(201);
    expect(otherClient.statusCode).toBe(201);
    expect(sameClientAgain.statusCode).toBe(429);
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

  it("names the room and the reason on a rejected request", async () => {
    const lines: Record<string, unknown>[] = [];
    const app = await buildApp(new RoomRegistry(), {
      logger: {
        level: "warn",
        stream: { write: (line: string) => void lines.push(JSON.parse(line) as Record<string, unknown>) },
      },
    });
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<PlayerSessionResponse>();

    const rejected = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    expect(rejected.statusCode).toBe(400);

    // Without these two fields a burst of 400s in the journal cannot be told
    // apart from any other, which is what made a laggy room undiagnosable.
    expect(lines).toContainEqual(
      expect.objectContaining({
        msg: "request rejected",
        route: "/api/rooms/:roomId/start",
        roomId: host.roomId,
        code: "NOT_ENOUGH_PLAYERS",
      }),
    );
  });

  it("compresses room pushes on the game socket", async () => {
    const app = await buildApp();
    apps.push(app);

    // Caddy's gzip covers HTTP only, so a late-game room push -- ~75 KB of map,
    // history and effects -- leaves this process uncompressed unless the socket
    // negotiates deflate itself.
    expect(app.websocketServer.options.perMessageDeflate).toMatchObject({ threshold: 1024 });
  });
});
