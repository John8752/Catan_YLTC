import { mkdir } from "node:fs/promises";
import { createGame, type GameState } from "../../packages/game-core/src/index.js";
import { collectVictoryWarnings, projectGameForPlayer, type RoomView, type VictoryWarningEffectView } from "../../packages/protocol/src/index.js";
import { expect, test, type Browser, type BrowserContextOptions, type WebSocketRoute } from "@playwright/test";
import { primaryPhoneCases, viewportCase } from "./viewport-cases.js";

async function openGame(browser: Browser, width: number, height: number, options: BrowserContextOptions = {}) {
  const base = createGame({ id: "victory-ui", seed: 42, ruleProfile: "extended-5-6", players: [
    { id: "p1", name: "自己的长名字", color: "terracotta" }, { id: "p2", name: "领先玩家的长名字", color: "ocean" },
    { id: "p3", name: "丙", color: "pine" }, { id: "p4", name: "丁", color: "wheat" },
    { id: "p5", name: "戊", color: "plum" }, { id: "p6", name: "己", color: "charcoal" },
  ] });
  let state: GameState = { ...base, revision: 1, phase: { kind: "turn", step: "action", activePlayerId: "p2", turnNumber: 1 },
    players: base.players.map((player) => ({ ...player, visibleVictoryPoints: 6 })),
  };
  let warnings: readonly VictoryWarningEffectView[] = [];
  const room = (): RoomView => ({
    id: "VICTORY", revision: state.revision, hostPlayerId: "p1", previewMap: null,
    members: state.players.map((player) => ({ id: player.id, name: player.name, color: player.color, isHost: player.id === "p1" })),
    settings: { ruleProfile: "extended-5-6", playerLimit: 6, victoryPointsToWin: state.victoryPointsToWin, mapSeed: 42, bankCountsPublic: true },
    game: projectGameForPlayer(state, "p1", warnings.map((warning) => ({ revision: warning.revision, event: { type: "piece_built", playerId: warning.playerId, piece: "city", locationId: "fixture" } })), null, { bankCountsPublic: true }, warnings),
  });
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", ...options });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "VICTORY", playerId: "p1", seatToken: "fixture" })));
  const page = await context.newPage();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/api\/rooms\/VICTORY\?/, (route) => route.fulfill({ json: room() }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => { socket = route; route.send(JSON.stringify({ type: "room_state", room: room() })); });
  await page.goto("/");
  await expect(page.locator(".hex-tile")).toHaveCount(30);
  await expect.poll(() => socket !== undefined).toBe(true);
  return { page, context, errors,
    push(score: number, phase: GameState["phase"] = state.phase, playerId = "p2") {
      const after = { ...state, revision: state.revision + 1, phase, players: state.players.map((player) => ({ ...player, visibleVictoryPoints: player.id === playerId ? score : player.visibleVictoryPoints })) };
      warnings = [...warnings, ...collectVictoryWarnings(state, after, warnings)];
      state = after;
      socket!.send(JSON.stringify({ type: "room_state", room: room() }));
    },
    duplicate: () => socket!.send(JSON.stringify({ type: "room_state", room: room() })),
  };
}

for (const { name, width, height, options } of [...primaryPhoneCases, ...([
  [360, 640], [390, 844], [960, 540], [1920, 1021], [3840, 2160],
] as const).map(([width, height]) => viewportCase(width, height))]) {
  test(`near-victory badges and notices fit ${name}`, async ({ browser }) => {
    const run = await openGame(browser, width, height, options);
    try {
      const { page } = run;
      const mapViewport = page.getByRole("region", { name: "可移动地图视口", exact: true });
      await mapViewport.focus();
      run.push(7);
      await expect(page.locator('[data-player-score="p2"]')).toHaveText("7/10");
      await expect(page.locator('[data-victory-notice]')).toContainText("7/10");
      await expect(mapViewport).toBeFocused();
      run.push(9, undefined, "p1");
      await expect(page.locator('.self-seat [data-player-score="p1"]')).toHaveText("9/10");
      await expect(page.locator('.self-seat [data-player-score="p1"]')).toHaveCSS("background-color", "rgb(255, 211, 123)");
      const metrics = await page.evaluate(() => {
        const within = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
        const badges = [...document.querySelectorAll('[data-victory-proximity]')];
        const banner = document.querySelector('[data-victory-notice]')!.getBoundingClientRect();
        const stage = document.querySelector('.board-stage')!.getBoundingClientRect();
        const dock = document.querySelector('.player-dock')!.getBoundingClientRect();
        const resource = document.querySelector('[data-self-resource-total]')!;
        const resourceBox = resource.getBoundingClientRect();
        const ownBadge = document.querySelector('.self-seat [data-player-score]')!.getBoundingClientRect();
        return { fits: badges.every((badge) => within(badge.getBoundingClientRect(), badge.closest('[data-player-target]')!.getBoundingClientRect())),
          resourceClear: resourceBox.right <= ownBadge.left && resourceBox.height < Number.parseFloat(getComputedStyle(resource).fontSize) * 2,
          overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          bannerClear: (banner.bottom <= stage.top || banner.left >= stage.right) && banner.left >= 0 && banner.right <= innerWidth,
          dockFits: dock.bottom <= innerHeight, pointer: getComputedStyle(document.querySelector('[data-attention-slot]')!).pointerEvents };
      });
      expect(metrics).toEqual({ fits: true, resourceClear: true, overflow: false, bannerClear: true, dockFits: true, pointer: "none" });
      await mkdir("output/playwright", { recursive: true });
      await page.screenshot({ path: `output/playwright/victory-warning-${width}x${height}.png`, fullPage: true, scale: "css" });
      run.duplicate();
      await page.clock.runFor(3_001);
      await expect(page.locator('[data-victory-notice]')).toContainText("9/10");
      await page.clock.runFor(3_001);
      await expect(page.locator('[data-victory-notice]')).toHaveCount(0);
      await expect(page.locator('[data-player-score="p2"]')).toHaveAttribute("data-victory-proximity", "3");
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}

test("milestones respect action priority, escalation, history, score loss, reconnect and victory", async ({ browser }) => {
  const run = await openGame(browser, 1920, 1021);
  const { page } = run;
  try {
    run.push(7, { kind: "turn", step: "roll", activePlayerId: "p1", turnNumber: 2 });
    await expect(page.locator('[data-action-notice]')).toHaveText("轮到你了");
    await expect(page.locator('[data-victory-notice]')).toHaveCount(0);
    await expect(page.locator('[data-history-type="victory-warning"]')).toHaveCount(1);
    await page.clock.runFor(1_501);
    await expect(page.locator('[data-victory-notice]')).toContainText("7/10");
    run.push(8);
    await expect(page.locator('[data-victory-notice]')).toContainText("8/10");
    run.push(9);
    await expect(page.locator('[data-victory-notice]')).toContainText("9/10");
    await expect(page.locator('[data-history-type="victory-warning"]')).toHaveCount(3);
    await page.reload();
    await expect(page.locator('[data-player-score="p2"]')).toHaveText("9/10");
    await expect(page.locator('[data-victory-notice]')).toHaveCount(0);
    run.push(6);
    await expect(page.locator('[data-player-score="p2"]')).not.toHaveAttribute("data-victory-proximity");
    run.push(9);
    await expect(page.locator('[data-player-score="p2"]')).toHaveText("9/10");
    await expect(page.locator('[data-victory-notice]')).toHaveCount(0);
    await expect(page.locator('[data-history-type="victory-warning"]')).toHaveCount(3);
    run.push(7, undefined, "p3");
    await expect(page.locator('[data-victory-notice]')).toContainText("7/10");
    run.push(10, { kind: "finished", winnerId: "p2" });
    await expect(page.locator('[data-victory-notice]')).toHaveCount(0);
    await expect(page.locator('[data-victory-proximity]')).toHaveCount(0);
    expect(run.errors).toEqual([]);
  } finally { await run.context.close(); }
});
