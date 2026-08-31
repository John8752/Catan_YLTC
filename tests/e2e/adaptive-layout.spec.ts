import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createGame, resourceAmounts, type GameState, type PlayerSeed, type GameEventRecord } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, test, type Browser, type BrowserContextOptions, type Page, type WebSocketRoute } from "@playwright/test";
import { primaryPhoneCases, viewportCase } from "./viewport-cases.js";

const players: PlayerSeed[] = [
  { id: "p1", name: "布局验收", color: "terracotta" },
  { id: "p2", name: "玩家甲", color: "ocean" },
  { id: "p3", name: "玩家乙", color: "pine" },
  { id: "p4", name: "玩家丙", color: "wheat" },
  { id: "p5", name: "玩家丁", color: "plum" },
  { id: "p6", name: "玩家戊", color: "charcoal" },
];
const sizes = [...primaryPhoneCases, ...([
  [1024, 768], [1366, 768], [1920, 1021], [2560, 1440], [3840, 2160],
  [3440, 1440], [1920, 720], [960, 540], [844, 390], [640, 360], [390, 844], [360, 640],
] as const).map(([width, height]) => viewportCase(width, height))];

function fixture(count: 4 | 6, revision = 40, finished = false): RoomView {
  const base = createGame({ id: "layout_game", seed: 93357307, players: players.slice(0, count), ruleProfile: count === 6 ? "extended-5-6" : "base-3-4" });
  const state: GameState = {
    ...base, revision, phase: finished ? { kind: "finished", winnerId: "p1" } : { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    lastRoll: [2, 3],
    players: base.players.map((player) => ({ ...player, resources: resourceAmounts({ brick: 2, lumber: 3, wool: 4, grain: 5, ore: 6 }) })),
  };
  const records: GameEventRecord[] = Array.from({ length: revision }, (_, i) => ({ revision: i + 1, event: { type: "dice_rolled", playerId: "p1", dice: [2, 3] } }));
  const projected = projectGameForPlayer(state, "p1", records);
  return {
    id: "LAYOUT", revision, hostPlayerId: "p1", previewMap: null,
    members: players.slice(0, count).map((p) => ({ ...p, isHost: p.id === "p1" })),
    settings: { ruleProfile: count === 6 ? "extended-5-6" : "base-3-4", playerLimit: count, victoryPointsToWin: 10, mapSeed: state.seed, bankCountsPublic: true },
    game: { ...projected, effects: [], history: projected.history.map((e) => ({ ...e, message: `第 ${e.revision} 次操作：布局验收掷出 2 + 3，其他玩家获得资源。` })) },
  };
}

async function openFixture(browser: Browser, width: number, height: number, room: RoomView, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...options });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/api\/rooms\/LAYOUT\?/, (route) => route.fulfill({ json: room }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => { socket = route; });
  await page.goto("/");
  await expect(page.locator(".hex-tile")).toHaveCount(room.game?.map.hexes.length ?? 0);
  await expect.poll(() => socket !== undefined).toBe(true);
  return { context, page, errors, push: (next: RoomView) => socket!.send(JSON.stringify({ type: "room_state", room: next })) };
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector(".board-stage")!.getBoundingClientRect();
    const fit = [...document.querySelectorAll(".hex-surface,.port-sign")].every((e) => {
      const b = e.getBoundingClientRect();
      return b.left >= board.left && b.right <= board.right && b.top >= board.top && b.bottom <= board.bottom;
    });
    const overlays = [...document.querySelectorAll('.board-zoom-controls,[data-resource-source="bank"],.phase-chip')].map((e) => e.getBoundingClientRect());
    const hudClear = [...document.querySelectorAll(".hex-surface,.port-sign")].every((e) => {
      const b = e.getBoundingClientRect();
      return overlays.every((o) => b.right <= o.left || b.left >= o.right || b.bottom <= o.top || b.top >= o.bottom);
    });
    const font = (selector: string) => Number.parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
    const signs = [...document.querySelectorAll<SVGRectElement>(".port-sign > rect")].map((element) => element.getBoundingClientRect());
    const intersect = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const portText = [...document.querySelectorAll<SVGTextElement>(".port-ratio")].map((element) => {
      const matrix = element.getScreenCTM()!;
      const text = element.getBoundingClientRect();
      const card = element.closest(".port-sign")!.querySelector("rect")!.getBoundingClientRect();
      return { font: Number.parseFloat(getComputedStyle(element).fontSize) * Math.hypot(matrix.a, matrix.b),
        fits: text.left >= card.left && text.right <= card.right && text.top >= card.top && text.bottom <= card.bottom };
    });
    const portContents = [...document.querySelectorAll(".port-sign")].map((sign) => {
      const card = sign.querySelector("rect")!.getBoundingClientRect();
      const icon = sign.querySelector(".port-type-icon")?.getBoundingClientRect();
      const ratio = sign.querySelector(".port-ratio")!.getBoundingClientRect();
      const generic = sign.parentElement!.getAttribute("data-port-resource") === "generic";
      const brickInk = sign.querySelector('[data-port-resource-icon="brick"] .resource-icon-primary');
      return { text: sign.textContent, generic,
        resource: sign.querySelector("[data-port-resource-icon]")?.getAttribute("data-port-resource-icon"),
        expectedResource: sign.parentElement!.getAttribute("data-port-resource"),
        bounds: { icon: icon?.toJSON(), card: card.toJSON(), ratio: ratio.toJSON() },
        iconHasInk: brickInk === null || getComputedStyle(brickInk).fill !== getComputedStyle(sign.querySelector("rect")!).fill,
        iconFits: icon !== undefined && icon.left >= card.left && icon.right <= card.right && icon.top >= card.top && icon.bottom <= ratio.top,
      };
    });
    return {
      fit, hudClear, rootFont: font("html"), nameFont: font(".opponent-strip strong"),
      portText, portContents, portsSeparated: signs.every((a, i) => signs.slice(i + 1).every((b) => !intersect(a, b))),
      portTileRatio: signs[0]!.width / document.querySelector(".hex-surface")!.getBoundingClientRect().width,
      portNumberOverlaps: [...document.querySelectorAll(".token")].flatMap((e) => signs.flatMap((sign, index) => intersect(sign, e.getBoundingClientRect()) ? [{ hex: e.closest('[data-hex-id]')?.getAttribute('data-hex-id'), portIndex: index }] : [])),
      statFont: font('[data-opponent-summary] [title="资源卡"]'),
      tile: rect(".hex-surface"), number: rect(".token-number"), dock: rect(".player-dock"),
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      sidebar: document.querySelector("[data-game-sidebar]")?.getBoundingClientRect().toJSON(),
    };
  });
}

for (const count of [4, 6] as const) {
  for (const { name, width, height, options } of sizes) {
    test(`${count} seats fit ${name} with readable controls and uncropped ports`, async ({ browser }) => {
      const room = fixture(count);
      const run = await openFixture(browser, width, height, room, options);
      try {
        if (options.isMobile) {
          // Catch accidentally using physical pixels or dropping device emulation.
          expect(await run.page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio, touch: navigator.maxTouchPoints > 0 })))
            .toEqual({ width, height, dpr: 3, touch: true });
        }
        if (width < 1024) {
          await expect(run.page.getByRole("button", { name: "结束回合", exact: true })).toBeHidden();
          await run.page.getByRole("button", { name: "展开本回合操作" }).click();
        }
        await expect(run.page.getByRole("button", { name: "结束回合", exact: true })).toBeVisible();
        if (width < 1024) await run.page.getByRole("button", { name: "收起本回合操作" }).click();
        await expect(run.page.locator("[data-player-target]")).toHaveCount(count);
        await expect(run.page.locator('[data-resource-source="bank"]')).toHaveCount(1);
        await expect(run.page.locator('[data-player-score]')).toHaveCount(count);
        await expect(run.page.locator('.self-seat [data-player-score="p1"]')).toHaveText("0");
        const bankHost = width >= 1024 ? '[data-game-sidebar]' : '.board-heading';
        await expect(run.page.locator(`${bankHost} [data-resource-source="bank"]`)).toBeVisible();
        if (width < 1024) await run.page.getByRole("button", { name: "查看银行库存" }).click();
        const bankCards = await run.page.locator('[aria-label="银行剩余资源"] [data-resource-card]').evaluateAll((cards) => cards.map((card) => {
          const count = card.querySelector('[data-resource-count]')!;
          const illustration = card.querySelector('[data-resource-illustration]')!;
          const b = card.getBoundingClientRect();
          const c = count.getBoundingClientRect();
          const i = illustration.getBoundingClientRect();
          return { text: card.textContent, title: card.getAttribute('title'), countFont: Number.parseFloat(getComputedStyle(count).fontSize), portrait: b.height > b.width, fits: c.left >= b.left && c.right <= b.right && c.top >= b.top && c.bottom <= i.top && i.bottom <= b.bottom, iconHeight: i.height };
        }));
        expect(bankCards).toHaveLength(5);
        for (const card of bankCards) {
          expect(card.text).toMatch(/^\d+$/);
          expect(card.title).toContain("银行剩余");
          expect(card.countFont).toBeGreaterThanOrEqual(width >= 1024 ? 20 : 16);
          expect(card.portrait).toBe(true);
          expect(card.fits).toBe(true);
          expect(card.iconHeight).toBeGreaterThanOrEqual(20);
        }
        if (width < 1024) {
          await run.page.keyboard.press("Escape");
          await expect(run.page.getByRole("dialog")).toHaveCount(0);
        }
        const scoreBounds = await run.page.locator('.self-seat [data-player-score="p1"]').boundingBox();
        const seatBounds = await run.page.locator('.self-seat').boundingBox();
        expect(scoreBounds!.x + scoreBounds!.width).toBeLessThanOrEqual(seatBounds!.x + seatBounds!.width);
        const metrics = await measure(run.page);
        expect(metrics.overflow).toBe(false);
        expect(metrics.fit).toBe(true);
        expect(metrics.hudClear).toBe(true);
        expect(metrics.portsSeparated).toBe(true);
        expect(metrics.portNumberOverlaps).toEqual([]);
        expect(metrics.portContents).toHaveLength(room.game!.map.ports.length);
        expect(metrics.portText).toHaveLength(room.game!.map.ports.length);
        for (const port of metrics.portContents) {
          expect(port.text).toBe(port.generic ? "3:1" : "2:1");
          expect(port.iconFits, `Port content overlap: ${port.expectedResource} ${JSON.stringify(port.bounds)}`).toBe(true);
          expect(port.iconHasInk).toBe(true);
          expect(port.resource).toBe(port.generic ? "unknown" : port.expectedResource);
        }
        for (const text of metrics.portText) {
          expect(text.fits).toBe(true);
          // Narrow icon-only ports still share the map's fit and zoom transform.
          expect(text.font / metrics.tile.width).toBeCloseTo(24 / (56 * Math.sqrt(3)), 4);
        }
        expect(metrics.portTileRatio).toBeCloseTo(54.4 / (56 * Math.sqrt(3)), 4);
        expect(metrics.dock.y + metrics.dock.height).toBeLessThanOrEqual(height + 1);
        if (width >= 1024) {
          const logViewport = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
          const logBounds = await logViewport.boundingBox();
          const footerBounds = await run.page.locator('aside[aria-label="房间状态"] [data-slot="card-footer"]').boundingBox();
          expect(logBounds!.height).toBeGreaterThanOrEqual(80);
          expect(logBounds!.y + logBounds!.height).toBeLessThanOrEqual(footerBounds!.y);
          expect(metrics.nameFont).toBeGreaterThanOrEqual(16);
          expect(metrics.statFont).toBeGreaterThanOrEqual(14);
          expect(metrics.sidebar?.x).toBeGreaterThan(metrics.dock.x + metrics.dock.width - 1);
          expect(metrics.sidebar?.y + metrics.sidebar?.height).toBeLessThanOrEqual(height + 1);
          // Two-line ports participate in fitting. Readability
          // and uncropped content replace the old one-line-port size benchmark.
        }
        const dir = path.join(process.cwd(), "output/playwright");
        await mkdir(dir, { recursive: true });
        await run.page.screenshot({ path: path.join(dir, `adaptive-${count}-${width}x${height}.png`), fullPage: true, scale: "css" });
        if (count === 6 && (width === 1920 && height === 1021 || width === 390)) {
          if (width < 1024) await run.page.getByRole("button", { name: "查看银行库存" }).click();
          await run.page.getByRole("region", { name: "银行剩余资源", exact: true }).screenshot({ path: path.join(dir, `bank-cards-${width}.png`) });
        }
        expect(run.errors).toEqual([]);
      } finally { await run.context.close(); }
    });
  }
}

test("large-screen type scales with CSS viewport, not Retina pixel density", async ({ browser }) => {
  const results: Awaited<ReturnType<typeof measure>>[] = [];
  for (const [width, height, dpr] of [[1920, 1021, 1], [1920, 1021, 2], [2560, 1440, 1], [3840, 2160, 1]]) {
    const run = await openFixture(browser, width!, height!, fixture(6), { deviceScaleFactor: dpr });
    results.push(await measure(run.page));
    await run.context.close();
  }
  expect(results[0]?.statFont).toBe(results[1]?.statFont);
  expect(results[2]!.statFont).toBeGreaterThan(results[0]!.statFont * 1.3);
  expect(results[3]!.statFont).toBeGreaterThan(results[0]!.statFont * 1.7);
});

for (const { name, width, height, options } of [...primaryPhoneCases, viewportCase(360, 640), viewportCase(640, 360)]) {
  test(`compact disclosure keeps live stock, zoom and required actions usable at ${name}`, async ({ browser }) => {
    let room = fixture(6);
    if (room.game?.interaction.kind !== "turn-action") throw new Error("Expected action fixture");
    room = { ...room, game: { ...room.game, interaction: { ...room.game.interaction, roadEdgeIds: [room.game.map.edges[0]!.id] } } };
    const run = await openFixture(browser, width, height, room, options);
    const { page } = run;
    try {
      const bank = page.getByRole("button", { name: "查看银行库存" });
      await bank.click();
      room = { ...room, revision: 41, game: { ...room.game!, revision: 41, bankResources: resourceAmounts({ brick: 7 }) } };
      run.push(room);
      await expect(page.getByLabel("银行剩余砖 7 张", { exact: true })).toBeVisible();
      await expect(page.locator('[data-resource-source="bank"]')).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(bank).toBeFocused();

      const fitted = await measure(page);
      const mapTools = page.getByRole("button", { name: "地图工具", exact: true });
      await expect(page.getByRole("button", { name: "放大地图", exact: true })).toBeHidden();
      await mapTools.click();
      await page.getByRole("button", { name: "放大地图", exact: true }).click();
      await expect.poll(async () => (await measure(page)).tile.width).toBeGreaterThan(fitted.tile.width * 1.1);
      expect((await measure(page)).portTileRatio).toBeCloseTo(fitted.portTileRatio, 4);
      await page.getByRole("button", { name: "恢复地图大小", exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(mapTools).toBeFocused();

      await page.getByRole("button", { name: "展开本回合操作" }).click();
      await expect(page.getByRole("button", { name: "结束回合", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "道路", exact: true }).click();
      await expect(page.getByRole("button", { name: "结束回合", exact: true })).toBeHidden();
      await expect(page.locator('[data-action-title]')).toHaveText("请在地图选择道路位置");
      await expect(page.getByRole("button", { name: "在这里建造道路", exact: true })).toHaveCount(1);
      room = { ...room, revision: 42, game: { ...room.game!, revision: 42,
        interaction: { kind: "turn-roll", instruction: "轮到你了，请掷骰子", vertexIds: [], edgeIds: [] },
      } };
      run.push(room);
      await expect(page.getByRole("button", { name: "掷骰子", exact: true })).toBeVisible();
      expect((await measure(page)).overflow).toBe(false);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}

test("opponent anchors survive breakpoints and room footer actions stay reachable", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(6));
  const anchor = await run.page.locator('[data-player-target="p2"]').elementHandle();
  try {
    const update = fixture(6, 41);
    run.push({ ...update, game: {
      ...update.game!,
      you: { ...update.game!.you, visibleVictoryPoints: 6 },
      players: update.game!.players.map((player) => player.id === "p1" ? { ...player, visibleVictoryPoints: 6 } : player),
      bankResources: { ...update.game!.bankResources, brick: 7 },
    } });
    await expect(run.page.locator('.self-seat [data-player-score="p1"]')).toHaveText("6");
    for (const [width, height] of [[390, 844], [1024, 768], [360, 640], [1920, 1021]]) {
      await run.page.setViewportSize({ width: width!, height: height! });
      await expect(run.page.locator('[data-player-target="p2"]')).toBeVisible();
      await expect(run.page.locator('[data-resource-source="bank"]')).toHaveCount(1);
      await expect(run.page.locator('.self-seat [data-player-score="p1"]')).toHaveText("6");
      if (width! < 1024) await run.page.getByRole("button", { name: "查看银行库存" }).click();
      await expect(run.page.getByLabel("银行剩余砖 7 张", { exact: true })).toBeVisible();
      if (width! < 1024) await run.page.keyboard.press("Escape");
      await expect(run.page.locator(`${width! >= 1024 ? '[data-game-sidebar]' : '.board-heading'} [data-resource-source="bank"]`)).toBeVisible();
      expect(await anchor!.evaluate((e) => e.isConnected)).toBe(true);
      if (width! < 1024) await run.page.getByRole("button", { name: /打开公开记录与房间信息/ }).click();
      const bounds = await run.page.locator('aside[aria-label="房间状态"] [data-slot="card-footer"]').boundingBox();
      for (const label of ["退出座位", "在新标签页开一个座位"]) {
        const action = run.page.getByRole("button", { name: label, exact: true });
        await expect(action).toBeVisible();
        const b = await action.boundingBox();
        expect(b!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(b!.x + b!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      }
      if (width! < 1024) await run.page.keyboard.press("Escape");
    }
  } finally { await run.context.close(); }
});

test("history appends below, follows live updates, preserves reading and reopens at the latest", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(6));
  const log = run.page.getByRole("log");
  const scroll = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
  const atBottom = () => scroll.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop < 3);
  try {
    await expect(log.locator("li").first()).toContainText("第 11 次操作");
    await expect(log.locator("li").last()).toContainText("第 40 次操作");
    await expect.poll(atBottom).toBe(true);
    run.push(fixture(6, 41));
    await expect(log.locator("li").last()).toContainText("第 41 次操作");
    await expect.poll(atBottom).toBe(true);
    await scroll.evaluate((e) => { e.scrollTop = 0; });
    await expect(run.page.getByRole("button", { name: "回到最新", exact: true })).toBeVisible();
    run.push(fixture(6, 42));
    await expect(run.page.getByRole("button", { name: /有新记录/ })).toBeVisible();
    expect(await atBottom()).toBe(false);
    await run.page.getByRole("button", { name: /有新记录/ }).click();
    await expect.poll(atBottom).toBe(true);
    await run.page.setViewportSize({ width: 390, height: 844 });
    await run.page.getByRole("button", { name: /打开公开记录与房间信息/ }).click();
    await expect(run.page.getByRole("dialog", { name: "公开记录与房间信息" })).toBeVisible();
    await expect.poll(atBottom).toBe(true);
    await run.page.keyboard.press("Escape");
    await expect(run.page.getByRole("dialog")).toHaveCount(0);
    expect(run.errors).toEqual([]);
  } finally { await run.context.close(); }
});

test("history keeps the same visible entry when retention drops older rows", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(6));
  const scroll = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
  try {
    await scroll.evaluate((e) => { e.scrollTop = 500; });
    await expect(run.page.getByRole("button", { name: "回到最新", exact: true })).toBeVisible();
    const reading = await scroll.evaluate((e) => {
      const row = [...e.querySelectorAll<HTMLElement>("li")].find((r) => r.getBoundingClientRect().bottom > e.getBoundingClientRect().top)!;
      return { key: row.dataset.historyKey, offset: row.getBoundingClientRect().top - e.getBoundingClientRect().top };
    });
    run.push(fixture(6, 42));
    await expect(run.page.getByRole("button", { name: /有新记录/ })).toBeVisible();
    const offset = await scroll.evaluate((e, key) => {
      const row = [...e.querySelectorAll<HTMLElement>("li")].find((r) => r.dataset.historyKey === key)!;
      return row.getBoundingClientRect().top - e.getBoundingClientRect().top;
    }, reading.key);
    expect(Math.abs(offset - reading.offset)).toBeLessThan(2);
  } finally { await run.context.close(); }
});

test("result tabs stay light in default, hover, selected and keyboard focus states", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(4, 40, true));
  try {
    const overview = run.page.getByRole("tab", { name: "概览", exact: true });
    const dice = run.page.getByRole("tab", { name: "骰子统计", exact: true });
    await expect(overview).toHaveCSS("color", "rgb(255, 255, 255)");
    // Normalize CSS Color 4 serialization (oklab/color-mix) to actual RGBA.
    const inactiveColor = await dice.evaluate((e) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      context.fillStyle = getComputedStyle(e).color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    });
    expect(inactiveColor.slice(0, 3).every((channel) => channel >= 254)).toBe(true);
    expect(inactiveColor[3]).toBeGreaterThanOrEqual(216);
    await dice.hover();
    await expect(dice).toHaveCSS("color", "rgb(255, 255, 255)");
    await overview.focus();
    await run.page.keyboard.press("ArrowRight");
    await expect(dice).toBeFocused();
    await expect(dice).toHaveAttribute("aria-selected", "true");
    await expect(dice).not.toHaveCSS("box-shadow", "none");
    expect(await dice.evaluate((e) => getComputedStyle(e, "::after").backgroundColor)).toBe("rgb(240, 197, 107)");
    for (const name of ["资源卡统计", "活动统计", "资源统计"]) {
      const tab = run.page.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveCSS("color", "rgb(255, 255, 255)");
      await expect(run.page.getByRole("tabpanel", { name, exact: true })).toBeVisible();
    }
    await run.page.screenshot({ path: path.join(process.cwd(), "output/playwright/adaptive-result-tabs.png"), fullPage: true });
    await run.page.setViewportSize({ width: 390, height: 844 });
    await expect(run.page.getByRole("tab", { name: "资源统计", exact: true })).toBeVisible();
    expect(run.errors).toEqual([]);
  } finally { await run.context.close(); }
});
