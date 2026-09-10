import type { RoomSession } from "@catan/protocol/platform";
import type { RoomView } from "@catan/protocol/catan";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";
import { RoomRegistry } from "../rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("platform room API", () => {
  it("lets only the host disband, tells every seat, and works mid-match", async () => {
    const app = await buildApp();
    apps.push(app);
    const host = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<RoomSession<RoomView>>();
    const guest = (await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/join`,
      payload: { playerName: "周" },
    })).json<RoomSession<RoomView>>();
    await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/start`,
      payload: { seatToken: host.seatToken },
    });

    // Leaving is still refused once the game is running -- that is the hole this fills.
    const leave = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/leave`,
      payload: { seatToken: host.seatToken },
    });
    expect(leave.json()).toMatchObject({ error: { code: "CANNOT_LEAVE_STARTED_GAME" } });

    const guestAttempt = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/disband`,
      payload: { seatToken: guest.seatToken },
    });
    expect(guestAttempt.statusCode).toBe(400);
    expect(guestAttempt.json()).toMatchObject({ error: { code: "ONLY_HOST_CAN_DISBAND" } });

    const disband = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/disband`,
      payload: { seatToken: host.seatToken },
    });
    expect(disband.statusCode).toBe(200);

    // Gone for everyone, not just the host.
    for (const seat of [host, guest]) {
      const after = await app.inject({
        method: "GET",
        url: `/api/rooms/${host.roomId}?seatToken=${encodeURIComponent(seat.seatToken)}`,
      });
      expect(after.statusCode).toBe(404);
      expect(after.json()).toMatchObject({ error: { code: "ROOM_NOT_FOUND" } });
    }
  });

  it("warns every subscriber before the disbanded room stops existing", () => {
    const registry = new RoomRegistry();
    const host = registry.createRoom("林");
    const guest = registry.joinRoom(host.roomId, "周");
    const closed: string[] = [];
    const unsubscribes = [host, guest].map((seat) => registry.subscribe(
      seat.roomId,
      seat.seatToken,
      () => {},
      () => closed.push(seat.playerId),
    ));

    registry.disbandRoom(host.roomId, host.seatToken);

    expect(closed).toEqual([host.playerId, guest.playerId]);
    expect(() => registry.getRoom(host.roomId, host.seatToken)).toThrow();
    unsubscribes.forEach((unsubscribe) => unsubscribe());
    registry.dispose();
  });

  it("releases lobby seats, transfers host ownership and deletes an empty room", async () => {
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
    })).json<RoomSession<RoomView>>();
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

  it("evicts abandoned rooms but keeps rooms that still have a live subscriber", async () => {
    let now = 1_000_000;
    const registry = new RoomRegistry({ now: () => now });
    const app = await buildApp(registry, { idleRoomTtlMs: 60_000 });
    apps.push(app);

    const abandoned = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "林" },
    })).json<RoomSession<RoomView>>();
    const watched = (await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { playerName: "周" },
    })).json<RoomSession<RoomView>>();
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
    })).json<RoomSession<RoomView>>();

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
