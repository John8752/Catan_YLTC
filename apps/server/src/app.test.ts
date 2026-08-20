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
      payload: { playerId: host.playerId },
    });
    const room = startResponse.json<RoomView>();

    expect(startResponse.statusCode).toBe(200);
    expect(room.game?.board).toHaveLength(19);
    expect(room.game?.phase.kind).toBe("setup");
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
      payload: { playerId: host.playerId },
    });

    expect(startResponse.statusCode).toBe(400);
    expect(startResponse.json()).toMatchObject({
      error: { code: "NOT_ENOUGH_PLAYERS" },
    });
  });
});
