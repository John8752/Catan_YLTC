import { mkdir } from "node:fs/promises";
import { createGame, resourceAmounts, type GameState } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, test, type Browser, type BrowserContextOptions, type WebSocketRoute } from "@playwright/test";
import { primaryPhoneCases, viewportCase } from "./viewport-cases.js";

const base = createGame({ id: "attention_e2e", seed: 42, ruleProfile: "extended-5-6", players: [
  { id: "p1", name: "自己", color: "terracotta" }, { id: "p2", name: "对手", color: "ocean" },
  { id: "p3", name: "丙", color: "pine" }, { id: "p4", name: "丁", color: "wheat" },
  { id: "p5", name: "戊", color: "plum" }, { id: "p6", name: "己", color: "charcoal" },
] });
const numbered = base.map.hexes.find((hex) => hex.numberToken !== null)!;
function scenario(revision: number, phase: GameState["phase"], extra: Partial<GameState> = {}): RoomView {
  const state = { ...base, revision, phase, map: { ...base.map, robberHexId: numbered.id }, ...extra };
  return {
    id: "NOTICE", revision, hostPlayerId: "p1", previewMap: null,
    members: base.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isHost: p.id === "p1" })),
    settings: { ruleProfile: "extended-5-6", playerLimit: 6, victoryPointsToWin: 10, mapSeed: base.seed, bankCountsPublic: false },
    game: projectGameForPlayer(state, "p1", [], null, { bankCountsPublic: false }),
  };
}
const turn = (step: Extract<GameState["phase"], { kind: "turn" }>["step"], activePlayerId = "p1", turnNumber = 1): GameState["phase"] => ({
  kind: "turn", step, activePlayerId, turnNumber, primaryPlayerId: step === "paired-action" ? "p2" : activePlayerId,
});
async function openScenario(browser: Browser, width: number, height: number, reducedMotion: "reduce" | "no-preference" = "no-preference", options: BrowserContextOptions = {}) {
  let room = scenario(1, turn("action", "p2"));
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion, ...options });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "NOTICE", playerId: "p1", seatToken: "fixture" })));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/api\/rooms\/NOTICE\?/, (route) => route.fulfill({ json: room }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => { socket = route; route.send(JSON.stringify({ type: "room_state", room })); });
  await page.goto("/");
  await expect(page.locator(".hex-tile")).toHaveCount(30);
  await expect.poll(() => socket !== undefined).toBe(true);
  return { context, page, errors, push: (next: RoomView) => { room = next; socket!.send(JSON.stringify({ type: "room_state", room })); } };
}

for (const { name, width, height, options } of [...primaryPhoneCases, ...([
  [360, 640], [390, 844], [960, 540], [1920, 1021],
] as const).map(([width, height]) => viewportCase(width, height))]) {
  test(`turn attention stays clear of the board at ${name}`, async ({ browser }) => {
    const run = await openScenario(browser, width, height, "no-preference", options);
    const { page } = run;
    try {
      await expect(page.locator('[data-action-attention="none"]')).toHaveCount(1);
      await expect(page.locator('[data-resource-source="bank"] [data-resource-count]')).toHaveCount(0);
      if (width < 1024) await page.getByRole("button", { name: "查看银行库存" }).click();
      await expect(page.locator('[aria-label="银行剩余资源"] [data-resource-card]')).toHaveCount(5);
      await expect(page.locator('[aria-label="银行剩余资源"] [data-resource-count]')).toHaveCount(0);
      if (width < 1024) await page.keyboard.press("Escape");
      const mapViewport = page.getByRole("region", { name: "可移动地图视口", exact: true });
      await mapViewport.focus();
      run.push(scenario(2, turn("roll")));
      await expect(page.locator('[data-action-title]')).toHaveText("轮到你了 · 请掷骰子");
      await expect(page.locator('[data-action-attention="required"]')).toHaveCount(1);
      await expect(page.locator('[data-action-notice]')).toHaveText("轮到你了");
      await expect(mapViewport).toBeFocused();
      const bounds = await page.evaluate(() => {
        const stage = document.querySelector('.board-stage')!.getBoundingClientRect();
        const banner = document.querySelector('[data-action-notice]')!.getBoundingClientRect();
        return { clear: banner.bottom <= stage.top || banner.left >= stage.right, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          pointer: getComputedStyle(document.querySelector('[data-attention-slot]')!).pointerEvents };
      });
      expect(bounds).toEqual({ clear: true, overflow: false, pointer: "none" });
      await mkdir("output/playwright", { recursive: true });
      await page.screenshot({ path: `output/playwright/turn-attention-${width}x${height}.png`, fullPage: true, scale: "css" });
      run.push(scenario(2, turn("roll")));
      run.push(scenario(3, turn("action")));
      await expect(page.locator('[data-action-notice]')).toHaveCount(0, { timeout: 2_500 });
      await expect(page.locator('[data-action-attention="required"]')).toHaveCount(1);
      run.push(scenario(4, turn("action")));
      await expect(page.locator('[data-action-notice]')).toHaveCount(0);
      run.push(scenario(5, turn("action", "p2")));
      await expect(page.locator('[data-action-attention="none"]')).toHaveCount(1);

      const robberBounds = await page.evaluate((hexId) => {
        const pawn = document.querySelector('[data-robber-piece]')!.getBoundingClientRect();
        const tile = document.querySelector(`[data-hex-id="${hexId}"] .hex-surface`)!.getBoundingClientRect();
        const token = document.querySelector(`[data-hex-id="${hexId}"] .token`)!.getBoundingClientRect();
        const anchor = document.querySelector(`[data-robber-anchor="${hexId}"]`)!.getBoundingClientRect();
        return { clear: pawn.bottom < token.top, upperLeft: pawn.x + pawn.width / 2 < tile.x + tile.width / 2 && pawn.y + pawn.height / 2 < tile.y + tile.height / 2,
          inside: pawn.left >= tile.left && pawn.right <= tile.right && pawn.top >= tile.top && pawn.bottom <= tile.bottom,
          anchorDistance: Math.hypot(pawn.x + pawn.width / 2 - anchor.x - anchor.width / 2, pawn.y + pawn.height / 2 - anchor.y - anchor.height / 2) };
      }, numbered.id);
      expect(robberBounds.clear).toBe(true);
      expect(robberBounds.upperLeft).toBe(true);
      expect(robberBounds.inside).toBe(true);
      expect(robberBounds.anchorDistance).toBeLessThan(0.5);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}

test("mandatory actions, paired actions and incoming trades have distinct prompts without replay on reload", async ({ browser }) => {
  const run = await openScenario(browser, 390, 844, "reduce");
  const { page } = run;
  try {
    const setupPhase = base.phase;
    if (setupPhase.kind !== "setup") throw new Error("Expected setup");
    run.push(scenario(2, setupPhase));
    await expect(page.locator('[data-action-title]')).toContainText("初始摆放 · 请放置定居点");
    await expect(page.locator('[data-action-notice]')).toHaveText("轮到你摆放了");
    expect(await page.locator('[data-action-notice]').evaluate((element) => element.getAnimations().length)).toBe(0);
    run.push(scenario(3, { ...setupPhase, step: "road", settlementVertexId: base.map.vertices[0]!.id }));
    await expect(page.locator('[data-action-title]')).toContainText("初始摆放 · 请放置道路");
    await expect(page.locator('[data-action-notice]')).toHaveCount(0, { timeout: 2_500 });
    run.push(scenario(4, turn("discard", "p2"), { pendingDiscards: [{ playerId: "p1", count: 2 }] }));
    await expect(page.locator('[data-action-title]')).toHaveText("需要你弃牌 · 请选择 2 张");
    await expect(page.locator('[data-action-notice]')).toHaveText("请弃掉 2 张资源");
    run.push(scenario(5, turn("discard", "p2")));
    await expect(page.locator('[data-action-attention="none"]')).toHaveCount(1);
    await expect(page.locator('[data-action-notice]')).toHaveCount(0);
    run.push(scenario(6, turn("robber")));
    await expect(page.locator('[data-action-title]')).toHaveText("需要你操作 · 请移动强盗");
    run.push(scenario(7, turn("paired-action")));
    await expect(page.locator('[data-action-notice]')).toHaveText("轮到你进行搭档行动");
    await expect(page.locator('[data-action-title]')).toContainText("搭档行动");
    run.push(scenario(8, turn("action", "p2"), { openTrade: {
      offerId: "offer", proposerId: "p2", give: resourceAmounts({ brick: 1 }), receive: resourceAmounts({ wool: 1 }), responses: [],
    } }));
    await expect(page.locator('[data-action-attention="trade"]')).toHaveCount(1);
    await expect(page.locator('[data-action-notice]')).toHaveText("收到一份交易报价");
    await page.reload();
    await expect(page.locator('[data-action-attention="trade"]')).toHaveCount(1);
    await expect(page.locator('[data-action-notice]')).toHaveCount(0);
    expect(run.errors).toEqual([]);
  } finally { await run.context.close(); }
});
