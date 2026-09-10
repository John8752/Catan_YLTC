import { expect, test } from "@playwright/test";
import { createDrawGuess, executeDrawGuess, taskFor } from "../../../packages/game-core/src/draw-guess/index.js";
import { DEFAULT_DRAW_GUESS_SETTINGS, projectDrawGuess, type DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";

function guessRoom(): DrawGuessRoomView {
  const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `朋友${i}` }));
  let state = createDrawGuess("keyboard", players, 42);
  for (const player of players) {
    const task = taskFor(state, player.id)!;
    state = executeDrawGuess(state, player.id, { type: "submit", matchId: state.id, taskId: task.id,
      page: { kind: "opening", word: state.suggestions[player.id]![0]!, strokes: [{ color: "#222222", width: 8, points: [[40, 40], [760, 40], [760, 560], [40, 560], [40, 40], [760, 560]] }] } });
  }
  return { id: "KEYBOARD", gameId: "draw-guess", matchId: state.id, revision: state.revision, hostPlayerId: "p0",
    members: players.map((player) => ({ ...player, color: "terracotta", isHost: player.id === "p0" })), settings: DEFAULT_DRAW_GUESS_SETTINGS, game: projectDrawGuess(state, "p0", null) };
}

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...primaryPhoneCases]) {
  test(`@draw-guess keyboard keeps the whole drawing and guess controls visible ${device.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(device.options);
    await context.addInitScript(() => {
      localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "KEYBOARD", playerId: "p0", seatToken: "test" }));
      // Reproduce iOS: keyboard changes/pans the visual viewport without resizing the layout viewport.
      const viewport = Object.assign(new EventTarget(), { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
      addEventListener("DOMContentLoaded", () => { Object.assign(viewport, { width: innerWidth, height: innerHeight }); viewport.dispatchEvent(new Event("resize")); });
    });
    const page = await context.newPage();
    let room = guessRoom();
    let publish = () => {};
    await page.route(/\/api\/rooms\/KEYBOARD\?/, (route) => route.fulfill({ json: room }));
    await page.route(/\/api\/rooms\/KEYBOARD\/draw-guess\//, (route) => route.fulfill({ json: room }));
    await page.routeWebSocket(/\/ws\?/, (socket) => { publish = () => socket.send(JSON.stringify({ type: "room_state", room })); publish(); });
    const assertFits = async (top: number, height: number) => {
      for (const locator of [page.getByRole("img", { name: "传来的画作" }), page.getByRole("textbox", { name: "你的猜测" }), page.getByRole("button", { name: "完成并提交", exact: true })]) {
        await expect.poll(async () => { const b = (await locator.boundingBox())!; return b.x >= 0 && b.x + b.width <= page.viewportSize()!.width + 1 && b.y >= top && b.y + b.height <= top + height + 1; }).toBe(true);
      }
      const drawing = (await page.getByRole("img", { name: "传来的画作" }).boundingBox())!;
      expect(drawing.height).toBeGreaterThan(100);
      expect(drawing.width / drawing.height).toBeCloseTo(4 / 3, 1);
    };
    try {
      await page.goto("/");
      const input = page.getByRole("textbox", { name: "你的猜测" });
      await input.fill("猜");
      await page.evaluate(() => { const main = document.querySelector("main")!; main.style.paddingTop = "59px"; main.style.paddingBottom = "34px"; });
      const originalHeight = await page.evaluate(() => innerHeight);
      for (const [height, offsetTop] of [[360, 100], [330, 160], [390, 60]]) {
        await page.evaluate(({ height, offsetTop }) => { Object.assign(visualViewport!, { height, offsetTop }); visualViewport!.dispatchEvent(new Event("resize")); visualViewport!.dispatchEvent(new Event("scroll")); }, { height, offsetTop });
        await assertFits(offsetTop!, height!);
        await expect(input).toBeFocused();
        await expect(input).toHaveValue("猜");
      }
      await page.screenshot({ path: testInfo.outputPath("keyboard.png"), scale: "css" });
      // Dismissal can briefly leave a stale pan offset; the layout must return to the top.
      await page.evaluate((height) => { Object.assign(visualViewport!, { height }); visualViewport!.dispatchEvent(new Event("resize")); }, originalHeight);
      await assertFits(0, originalHeight);
      await expect(page.locator("main")).toHaveCSS("top", "0px");
      room = { ...room, revision: room.revision + 1, game: { ...room.game!, task: { ...room.game!.task!, submitted: true } } }; publish();
      await expect(page.getByRole("heading", { name: "交稿成功！" })).toBeVisible();
      await expect(page.locator("main")).not.toHaveCSS("position", "fixed");
    } finally { await context.close(); }
  });
}
