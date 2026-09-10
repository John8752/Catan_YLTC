import { expect, test } from "@playwright/test";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";
import type { DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";

test("@draw-guess an old timeout never submits the next round for players who already handed in", async ({ browser, request }) => {
  test.setTimeout(100_000);
  const host: RoomSession = await (await request.post("/api/rooms", { data: { playerName: "等待自动收稿", gameId: "draw-guess" } })).json();
  const sessions = [host];
  for (let i = 1; i < 3; i++) sessions.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `已交稿朋友${i}` } })).json());
  const snapshot = async (seat: RoomSession): Promise<DrawGuessRoomView> => (await request.get(`/api/rooms/${host.roomId}?seatToken=${seat.seatToken}`)).json();
  const contexts = await Promise.all(sessions.slice(0, 2).map(async (seat) => {
    const context = await browser.newContext();
    await context.addInitScript((stored) => localStorage.setItem("catan-yltc-seat", JSON.stringify(stored)), seat); return context;
  }));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  try {
    await Promise.all(pages.map((page) => page.goto("/")));
    await pages[0]!.getByLabel("画画时间", { exact: true }).selectOption("60");
    await pages[0]!.getByRole("button", { name: "开始传画猜词" }).click();
    for (const seat of sessions) {
      const game = (await snapshot(seat)).game!, task = game.task!;
      const content = { kind: "opening", word: task.suggestions[0]!, strokes: [{ color: "#222222", width: 8, points: [[10, 20], [100, 200]] }] };
      const command = { type: seat === host ? "draft" : "submit", matchId: game.id, taskId: task.id, page: content, ...(seat === host ? { sequence: 1 } : {}) };
      expect((await request.post(`/api/rooms/${host.roomId}/draw-guess/commands`, { data: { seatToken: seat.seatToken, commandId: "opening", command } })).ok()).toBe(true);
    }
    await expect(pages[1]!.getByRole("heading", { name: "交稿成功！" })).toBeVisible();
    await Promise.all(pages.map((page) => expect(page.getByRole("textbox", { name: "你的猜测", exact: true })).toBeVisible({ timeout: 65_000 })));
    for (const seat of sessions) {
      const game = (await snapshot(seat)).game!;
      expect(game.phase).toEqual({ kind: "work", step: 1 }); expect(game.task?.submitted).toBe(false);
      expect(game.progress.every((player) => !player.submitted)).toBe(true);
      expect(game.deadline!.deadlineAt - game.deadline!.serverNow).toBeGreaterThan(50_000);
    }
    for (let i = 0; i < pages.length; i++) {
      const game = (await snapshot(sessions[i]!)).game!;
      await pages[i]!.getByRole("textbox", { name: "你的猜测", exact: true }).fill("猜".repeat(game.task!.hintLength!));
      await pages[i]!.getByRole("button", { name: "完成并提交", exact: true }).click();
      await expect(pages[i]!.getByRole("heading", { name: "交稿成功！" })).toBeVisible();
    }
  } finally { await Promise.all(contexts.map((context) => context.close())); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
});
