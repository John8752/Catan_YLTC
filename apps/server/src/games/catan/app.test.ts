import type { RoomSession } from "@catan/protocol/platform";
import type { RoomView } from "@catan/protocol/catan";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { RoomRegistry } from "../../rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("catan room API", () => {
  it("starts a two-player match on the standard profile and still refuses a solo one", async () => {
    const app = await buildApp();
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<RoomSession<RoomView>>();

    // One seat is not a match: the profile floor is what turns it away.
    const soloStart = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    expect(soloStart.statusCode).toBe(400);
    expect(soloStart.json()).toMatchObject({ error: { code: "NOT_ENOUGH_PLAYERS" } });

    await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "周" },
    });
    const started = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });
    expect(started.statusCode).toBe(200);
    const room = started.json<RoomView>();
    // Two seats, but nothing else about the table changes.
    expect(room.game?.players).toHaveLength(2);
    expect(room.settings).toMatchObject({ ruleProfile: "base-3-4", playerLimit: 4 });
    expect(room.game?.map.hexes).toHaveLength(19);
    expect(room.game?.phase.kind).toBe("setup");
  });

  it("lets members choose unoccupied colors and lets only the host shuffle the authoritative seat order", async () => {
    const app = await buildApp();
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<RoomSession<RoomView>>();
    const second = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "周" },
    })).json<RoomSession<RoomView>>();
    const third = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "陈" },
    })).json<RoomSession<RoomView>>();

    const hostColorResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/player-color`,
      payload: { seatToken: host.seatToken, expectedRevision: third.room.revision, color: "coral" },
    });
    const hostColoredRoom = hostColorResponse.json<RoomView>();
    expect(hostColorResponse.statusCode).toBe(200);
    expect(hostColoredRoom.members.find((member) => member.id === host.playerId)?.color).toBe("coral");

    const occupiedResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/player-color`,
      payload: { seatToken: second.seatToken, expectedRevision: hostColoredRoom.revision, color: "coral" },
    });
    expect(occupiedResponse.statusCode).toBe(400);
    expect(occupiedResponse.json()).toMatchObject({ error: { code: "PLAYER_COLOR_TAKEN" } });

    const secondColorResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/player-color`,
      payload: { seatToken: second.seatToken, expectedRevision: hostColoredRoom.revision, color: "graphite" },
    });
    const recoloredRoom = secondColorResponse.json<RoomView>();
    expect(secondColorResponse.statusCode).toBe(200);
    expect(recoloredRoom.members.find((member) => member.id === second.playerId)?.color).toBe("graphite");

    const guestShuffleResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/shuffle-members`,
      payload: { seatToken: second.seatToken, expectedRevision: recoloredRoom.revision },
    });
    expect(guestShuffleResponse.statusCode).toBe(400);
    expect(guestShuffleResponse.json()).toMatchObject({ error: { code: "ONLY_HOST_CAN_SHUFFLE" } });

    const orderBeforeShuffle = recoloredRoom.members.map((member) => member.id);
    const colorsByPlayer = new Map(recoloredRoom.members.map((member) => [member.id, member.color]));
    const shuffleResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/shuffle-members`,
      payload: { seatToken: host.seatToken, expectedRevision: recoloredRoom.revision },
    });
    const shuffledRoom = shuffleResponse.json<RoomView>();
    expect(shuffleResponse.statusCode).toBe(200);
    expect(shuffledRoom.members.map((member) => member.id)).not.toEqual(orderBeforeShuffle);
    expect(new Set(shuffledRoom.members.map((member) => member.id))).toEqual(new Set(orderBeforeShuffle));
    for (const member of shuffledRoom.members) expect(member.color).toBe(colorsByPlayer.get(member.id));

    const started = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    })).json<RoomView>();
    expect(started.game?.players.map((player) => player.id)).toEqual(shuffledRoom.members.map((member) => member.id));
    expect(started.game?.players.map((player) => player.color)).toEqual(shuffledRoom.members.map((member) => member.color));
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
    const host = createResponse.json<RoomSession<RoomView>>();
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
        victoryPointsToWin: 7,
      },
    });
    const configuredRoom = settingsResponse.json<RoomView>();
    expect(settingsResponse.statusCode).toBe(200);
    // The seat cap now rides on the profile rather than being set on its own.
    expect(configuredRoom.settings).toMatchObject({ ruleProfile: "base-3-4", playerLimit: 4, victoryPointsToWin: 7 });

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
    const second = secondResponse.json<RoomSession<RoomView>>();
    const nonHostSettingsResponse = await app.inject({
      method: "PATCH",
      url: `/api/rooms/${host.roomId}/settings`,
      payload: {
        seatToken: second.seatToken,
        expectedRevision: second.room.revision,
        ruleProfile: "base-3-4",
        victoryPointsToWin: 10,
      },
    });
    expect(nonHostSettingsResponse.statusCode).toBe(400);
    expect(nonHostSettingsResponse.json()).toMatchObject({ error: { code: "ONLY_HOST_CAN_CONFIGURE" } });

    for (const playerName of ["陈", "赵"]) {
      const seated = await app.inject({
        method: "POST",
        url: `/api/rooms/${host.roomId}/join`,
        payload: { playerName },
      });
      expect(seated.statusCode).toBe(200);
    }
    // base-3-4 seats four; the fifth is what the profile's cap turns away.
    const fullResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "钱" },
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
    const host = createResponse.json<RoomSession<RoomView>>();

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
    })).json<RoomSession<RoomView>>();
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
    })).json<RoomSession<RoomView>>();

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

  it("prevents a room from starting with fewer than three players", async () => {
    const app = await buildApp();
    apps.push(app);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    });
    const host = createResponse.json<RoomSession<RoomView>>();
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
