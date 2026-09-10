import { expect, test } from "@playwright/test";
import { createDrawGuess, executeDrawGuess, taskFor } from "../../../packages/game-core/src/draw-guess/index.js";
import { DEFAULT_DRAW_GUESS_SETTINGS, projectDrawGuess, type DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import { iPhone16BrowserAreaCases } from "../viewport-cases.js";

function finishedRoom(): DrawGuessRoomView {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `朋友${i}的很长显示名称用于检查画册换行` }));
  let state = createDrawGuess("gallery", players, 42);
  while (state.phase.kind === "work") for (const player of players) {
    const task = taskFor(state, player.id)!;
    const strokes = [{ color: "#222222", width: 8, points: [[40, 40], [700, 500]] as const }];
    state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: task.id,
      page: task.kind === "opening" ? { kind: "opening", word: state.suggestions[player.id]![0]!, strokes } : task.kind === "drawing" ? { kind: "drawing", strokes } : { kind: "text", text: "企鹅骑自行车" } });
  }
  while (state.phase.kind === "reveal") state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: state.phase.cursor });
  return { id: "GALLERY", gameId: "draw-guess", matchId: state.id, revision: 100, hostPlayerId: "p0",
    members: players.map((player) => ({ ...player, color: "terracotta", isHost: player.id === "p0" })), settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "p0", null) };
}

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...iPhone16BrowserAreaCases]) {
  test(`@draw-guess finished gallery keeps narration below drawings ${device.name}`, async ({ browser }, testInfo) => {
    const room = finishedRoom();
    const context = await browser.newContext(device.options);
    await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "GALLERY", playerId: "p0", seatToken: "test" })));
    const page = await context.newPage();
    await page.route(/\/api\/rooms\/GALLERY\?/, (route) => route.fulfill({ json: room }));
    await page.routeWebSocket(/\/ws\?/, (socket) => socket.send(JSON.stringify({ type: "room_state", room })));
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "本场画册已全部揭晓" })).toBeVisible();
      await page.getByLabel("选择画册").getByRole("button").first().click();
      await expect(page.getByRole("article")).toHaveCount(6);
      const host = page.getByRole("region", { name: "系统主持人串词" });
      await expect(host).toContainText("圆满收工");
      await page.evaluate(() => scrollTo(0, 0));
      const hostBounds = (await host.boundingBox())!, last = (await page.getByRole("article").last().boundingBox())!;
      expect(hostBounds.y).toBeGreaterThanOrEqual(last.y + last.height);
      await host.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByRole("button", { name: "回到房间，再来一局" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("finished-gallery.png"), fullPage: true, scale: "css" });
    } finally { await context.close(); }
  });
}
