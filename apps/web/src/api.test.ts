import { afterEach, expect, it, vi } from "vitest";
import { ApiError, submitGameCommand, type PlayerSession } from "./api.js";

const session: PlayerSession = { roomId: "BAB434", playerId: "player_1", seatToken: "seat" };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubRejection(code: string, message: string): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    JSON.stringify({ error: { code, message } }),
    { status: 400, headers: { "content-type": "application/json" } },
  )));
}

it("carries the server's code alongside the message it shows the player", async () => {
  stubRejection("NOT_YOUR_TURN", "现在不是你的回合");

  // The message is what the player reads; the code is what App.tsx reads to
  // decide whether the local room copy is stale and worth refetching.
  const caught = await submitGameCommand(session, 7, { type: "EndTurn" }).catch((error: unknown) => error);

  expect(caught).toBeInstanceOf(ApiError);
  expect(caught).toMatchObject({ code: "NOT_YOUR_TURN", message: "现在不是你的回合" });
});

it("keeps a stale revision distinguishable from a refused move", async () => {
  stubRejection("STALE_REVISION", "游戏状态已更新，请重试");

  const caught = await submitGameCommand(session, 7, { type: "RollDice" }).catch((error: unknown) => error);

  expect((caught as ApiError).code).toBe("STALE_REVISION");
});
