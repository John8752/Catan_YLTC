import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiCommentator } from "./ai-commentary.js";
import { buildApp } from "./app.js";
import { RoomRegistry } from "./rooms.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("AI commentary API", () => {
  it("authenticates the seat, binds the response to a revision, and returns the commentary", async () => {
    const { registry, host, room } = startedRoom();
    const analyze = vi.fn<AiCommentator["analyze"]>(async () => "领先不等于稳，七点还在桌边磨刀。");
    const app = await buildApp(registry, { aiCommentator: { analyze, analyzeSetup: unusedSetupAnalysis } });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/ai-commentary`,
      payload: { seatToken: host.seatToken, expectedRevision: room.game?.revision, mode: "prediction" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      mode: "prediction",
      revision: room.game?.revision,
      content: "领先不等于稳，七点还在桌边磨刀。",
    });
    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ id: host.roomId }), "prediction");
    expect(JSON.stringify(analyze.mock.calls[0]?.[0])).not.toContain(host.seatToken);
  });

  it("does not spend an AI request on a stale game snapshot", async () => {
    const { registry, host, room } = startedRoom();
    const analyze = vi.fn<AiCommentator["analyze"]>(async () => "unused");
    const app = await buildApp(registry, { aiCommentator: { analyze, analyzeSetup: unusedSetupAnalysis } });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/ai-commentary`,
      payload: { seatToken: host.seatToken, expectedRevision: (room.game?.revision ?? 1) + 1, mode: "summary" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: "STALE_REVISION" } });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("limits paid requests independently from ordinary game commands", async () => {
    const { registry, host, room } = startedRoom();
    const app = await buildApp(registry, {
      aiCommentator: { analyze: async () => "ok", analyzeSetup: unusedSetupAnalysis },
      aiRequestsPerMinute: 1,
    });
    apps.push(app);
    const request = () => app.inject({
      method: "POST",
      url: `/api/rooms/${host.roomId}/ai-commentary`,
      payload: { seatToken: host.seatToken, expectedRevision: room.game?.revision, mode: "commentary" },
    });

    expect((await request()).statusCode).toBe(200);
    const limited = await request();
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: { code: "TOO_MANY_REQUESTS" } });
  });
});

function startedRoom() {
  const registry = new RoomRegistry();
  const host = registry.createRoom("林");
  registry.joinRoom(host.roomId, "周");
  registry.joinRoom(host.roomId, "陈");
  const room = registry.startRoom(host.roomId, host.seatToken);
  return { registry, host, room };
}

async function unusedSetupAnalysis() {
  return { playerComments: [], predictedWinnerId: "unused", prediction: "unused" };
}
