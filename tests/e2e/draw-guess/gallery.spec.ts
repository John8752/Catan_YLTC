import { expect, test } from "@playwright/test";
import { createDrawGuess, executeDrawGuess, taskFor, requiredGuessLength } from "../../../packages/game-core/src/draw-guess/index.js";
import { DEFAULT_DRAW_GUESS_SETTINGS, projectDrawGuess, type DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";

function finishedRoom(cursor?: number): DrawGuessRoomView {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `朋友${i}的很长显示名称用于检查画册换行` }));
  let state = createDrawGuess("gallery", players, 42);
  while (state.phase.kind === "work") for (const player of players) {
    const task = taskFor(state, player.id)!;
    const strokes = [{ color: "#222222", width: 8, points: [[40, 40], [700, 500]] as const }];
    state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: task.id,
      page: task.kind === "opening" ? { kind: "opening", word: state.suggestions[player.id]![0]!, strokes } : task.kind === "drawing" ? { kind: "drawing", strokes } : { kind: "text", text: "猜".repeat(requiredGuessLength(state, task) ?? 3) } });
  }
  while (state.phase.kind === "reveal" && (cursor === undefined || state.phase.cursor < cursor)) state = executeDrawGuess(state, null, { type: "reveal", matchId: state.id, expectedCursor: state.phase.cursor });
  return { id: "GALLERY", gameId: "draw-guess", matchId: state.id, revision: 100 + state.revision, hostPlayerId: "p0",
    members: players.map((player) => ({ ...player, color: "terracotta", isHost: player.id === "p0" })), settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "p0", null) };
}

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...primaryPhoneCases]) {
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
      await expect(page.getByRole("article").nth(0)).toContainText("我的题目是");
      await expect(page.getByRole("article").nth(1)).toContainText("我猜的是");
      await expect(page.getByRole("article").nth(2)).toContainText("我要画的是");
      for (let step = 0; step < 6; step++) {
        const entry = page.getByRole("article").nth(step);
        const speech = (await entry.getByLabel(`第 ${step + 1} 棒发言`).boundingBox())!;
        const commentary = (await entry.getByLabel(`第 ${step + 1} 页主持人串词`).boundingBox())!;
        expect(commentary.y).toBeGreaterThan(speech.y + speech.height);
      }
      await expect(page.locator('[data-own="true"]')).toHaveCSS("flex-direction", "row-reverse");
      await expect(page.getByRole("button", { name: "点赞，0 次", exact: true })).toHaveCount(6);
      await expect(page.getByRole("button", { name: "喝倒彩，0 次", exact: true })).toHaveCount(6);
      const host = page.getByRole("region", { name: "系统主持人串词" });
      await expect(host).toContainText("圆满收工");
      await page.evaluate(() => scrollTo(0, 0));
      const hostBounds = (await host.boundingBox())!, last = (await page.getByRole("article").last().boundingBox())!;
      expect(hostBounds.y).toBeGreaterThanOrEqual(last.y + last.height);
      await host.scrollIntoViewIfNeeded();
      await page.getByLabel("选择画册").getByRole("button").nth(1).evaluate((button: HTMLButtonElement) => button.click());
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await expect(page.getByRole("heading", { name: "本场画册已全部揭晓" })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await expect(page.getByRole("button", { name: "回到房间，再来一局" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("finished-gallery.png"), fullPage: true, scale: "css" });
    } finally { await context.close(); }
  });

  test(`@draw-guess reveal appends each speaker and album without shifting previous pages ${device.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(device.options);
    await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "GALLERY", playerId: "p0", seatToken: "test" })));
    const page = await context.newPage();
    let room = finishedRoom(0);
    let publish: (next: DrawGuessRoomView) => void = () => { throw new Error("Socket not connected"); };
    await page.route(/\/api\/rooms\/GALLERY\?/, (route) => route.fulfill({ json: room }));
    await page.routeWebSocket(/\/ws\?/, (socket) => {
      publish = (next) => { room = { ...next, revision: Math.max(room.revision + 1, next.revision) }; socket.send(JSON.stringify({ type: "room_state", room })); };
      publish(room);
    });
    const positions = () => page.getByRole("article").evaluateAll((entries) => entries.map((entry) => {
      const bounds = entry.getBoundingClientRect(); return { top: Math.round(bounds.top + scrollY), height: Math.round(bounds.height) };
    }));
    const latestIsFollowed = async () => {
      const latest = page.getByRole("article").last();
      await expect(latest).toBeFocused();
      await expect.poll(async () => latest.evaluate((entry) => {
        const box = entry.getBoundingClientRect();
        return box.height > innerHeight - 24 ? Math.abs(box.top - 12) <= 2 : box.top >= 0 && box.bottom <= innerHeight;
      })).toBe(true);
    };
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "准备好了？一起揭晓！" })).toBeFocused();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole("article")).toHaveCount(0);
      let previousPositions: Awaited<ReturnType<typeof positions>> = [];
      for (let cursor = 1; cursor <= 8; cursor++) {
        publish(finishedRoom(cursor));
        await expect(page.getByRole("article")).toHaveCount(cursor);
        await expect(page.getByLabel("选择画册")).toHaveCount(0);
        await latestIsFollowed();
        const nextPositions = await positions();
        expect(nextPositions.slice(0, -1)).toEqual(previousPositions);
        previousPositions = nextPositions;
        if (cursor === 2 || cursor === 7) await page.screenshot({ path: testInfo.outputPath(`reveal-${cursor}.png`), scale: "css" });
        if (cursor === 2) {
          await page.evaluate(() => scrollTo({ top: 100, behavior: "instant" }));
          const previousY = await page.evaluate(() => scrollY);
          publish({ ...room, game: { ...room.game!, albums: room.game!.albums.map((album) => ({ ...album, pages: album.pages.map((entry) => ({ ...entry, reactions: { up: 1, down: 0 } })) })) } });
          await expect(page.getByRole("button", { name: "点赞，1 次", exact: true })).toHaveCount(2);
          expect(await page.evaluate(() => scrollY)).toBe(previousY);
        }
        if (cursor === 7) {
          await page.reload();
          await expect(page.getByRole("article")).toHaveCount(7);
          await latestIsFollowed();
        }
      }
      // Reduced motion follows the next server cursor without an animation.
      await page.emulateMedia({ reducedMotion: "reduce" });
      publish(finishedRoom(36));
      await expect(page.getByRole("article")).toHaveCount(36);
      await latestIsFollowed();
      const beforeFinish = await positions();
      publish(finishedRoom());
      await expect(page.getByRole("region", { name: "系统主持人串词" })).toBeFocused();
      await expect(page.getByRole("article")).toHaveCount(36);
      expect(await positions()).toEqual(beforeFinish);
      await expect(page.getByRole("button", { name: "全部画册", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("选择画册").getByRole("button").first().click();
      await expect(page.getByRole("article")).toHaveCount(6);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await page.getByRole("button", { name: "全部画册", exact: true }).click();
      await expect(page.getByRole("article")).toHaveCount(36);
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await context.close(); }
  });
}
