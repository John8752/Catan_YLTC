import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resourceAmounts } from "../../packages/game-core/src/index.js";
import { expect, test } from "@playwright/test";
import { fixture, openFixture, measure } from "./layout-fixture.js";
import { primaryPhoneCases, viewportCase } from "./viewport-cases.js";

const sizes = [...primaryPhoneCases, ...([
  [1024, 768], [1366, 768], [1920, 1021], [2560, 1440], [3840, 2160],
  [3440, 1440], [1920, 720], [960, 540], [390, 844], [360, 640],
] as const).map(([width, height]) => viewportCase(width, height))];

for (const count of [4, 6] as const) {
  for (const { name, width, height, options } of sizes) {
    test(`${count} seats fit ${name} with readable controls and bounded port overflow`, async ({ browser }) => {
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
        await expect(run.page.locator('[data-turn-forecast]')).toBeVisible();
        await expect(run.page.locator('[data-turn-forecast]')).toHaveAttribute("data-turn-forecast-distance", "0");
        expect(await run.page.evaluate(() => {
          const summary = document.querySelector('[data-turn-forecast-summary]')?.getBoundingClientRect();
          const utilities = document.querySelector('[data-table-utilities]')?.getBoundingClientRect();
          return summary !== undefined && utilities !== undefined &&
            summary.left < utilities.right && summary.right > utilities.left &&
            summary.top < utilities.bottom && summary.bottom > utilities.top;
        })).toBe(false);
        // One badge per seat in the order column, plus the local player's own in
        // the dock -- the local seat deliberately appears in both.
        await expect(run.page.locator('.seat-column [data-player-score]')).toHaveCount(count);
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
        if (width >= 1360) expect(metrics.forecast.width / metrics.opponents.width).toBeCloseTo(2, 1);
        else if (width >= 1280) expect(metrics.forecast.width / metrics.opponents.width).toBeGreaterThanOrEqual(1.85);
        expect(metrics.overflow).toBe(false);
        expect(metrics.terrainFit).toBe(true);
        expect(metrics.maxPortOverflow).toBeLessThanOrEqual(metrics.tile.width * 0.2);
        expect(metrics.portsSeparated).toBe(true);
        expect(metrics.portNumberOverlaps).toEqual([]);
        expect(metrics.portContents).toHaveLength(room.game!.map.ports.length);
        expect(metrics.portText).toHaveLength(room.game!.map.ports.length);
        for (const port of metrics.portContents) {
          expect(port.text).toBe(port.generic ? "3:1" : "2:1");
          expect(port.iconFits, `Port content overlap: ${port.expectedResource} ${JSON.stringify(port.bounds)}`).toBe(true);
          expect(port.contentGap, `Port content too far apart: ${port.expectedResource} ${JSON.stringify(port.bounds)}`)
            .toBeLessThanOrEqual(metrics.tile.width * 0.09);
          expect(port.iconHasInk).toBe(true);
          expect(port.resource).toBe(port.generic ? "unknown" : port.expectedResource);
        }
        for (const text of metrics.portText) {
          // Narrow icon-only ports still share the map's presentation transform.
          expect(text.font / metrics.tile.width).toBeCloseTo(21 / (56 * Math.sqrt(3)), 4);
        }
        expect(metrics.portTileRatio).toBeCloseTo(48 / (56 * Math.sqrt(3)), 4);
        expect(metrics.dock.y + metrics.dock.height).toBeLessThanOrEqual(height + 1);
        if (width >= 1024) {
          const logViewport = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
          const logBounds = await logViewport.boundingBox();
          const roomPanelBounds = await run.page.locator('aside[aria-label="房间状态"] [data-slot="card"]').boundingBox();
          expect(logBounds!.height).toBeGreaterThanOrEqual(80);
          expect(logBounds!.y + logBounds!.height).toBeLessThanOrEqual(roomPanelBounds!.y + roomPanelBounds!.height);
          expect(metrics.nameFont).toBeGreaterThanOrEqual(16);
          expect(metrics.statFont).toBeGreaterThanOrEqual(14);
          expect(metrics.dock.x).toBeGreaterThanOrEqual(metrics.sidebar!.x);
          expect(metrics.dock.right).toBeLessThanOrEqual(metrics.sidebar!.right);
          expect(metrics.dock.bottom).toBeCloseTo(metrics.sidebar!.bottom, 0);
          expect(metrics.board.right).toBeLessThanOrEqual(metrics.sidebar!.x);
          if (width >= 1280) {
            expect(metrics.opponents.right).toBeLessThanOrEqual(metrics.board.x);
            expect(metrics.board.y).toBeCloseTo(metrics.sidebar!.y, 0);
            expect(metrics.board.bottom).toBeCloseTo(metrics.sidebar!.bottom, 0);
          } else {
            expect(metrics.opponents.bottom).toBeLessThanOrEqual(metrics.board.y);
          }
          // The forecast reads as turn order, so it sits above the seat column now.
          await expect(run.page.locator('.seat-column [data-turn-forecast]')).toBeVisible();
          await expect(run.page.locator('[data-game-sidebar] [data-turn-forecast]')).toHaveCount(0);
          await expect(run.page.locator('[data-game-sidebar] [data-attention-slot]')).toHaveCount(0);
          await expect(run.page.locator('[data-game-sidebar]')).not.toContainText("轮到你了，请掷骰子");
          await expect(run.page.locator('[data-game-sidebar] [aria-label="放大地图"]')).toHaveCount(0);
          await expect(run.page.locator('.live-playfield .board-heading,.live-playfield .board-footer,.live-playfield [data-attention-slot]')).toHaveCount(0);
          expect(metrics.sidebar?.y + metrics.sidebar?.height).toBeLessThanOrEqual(height + 1);
          // Two-line ports participate in fitting. Readability
          // and uncropped content replace the old one-line-port size benchmark.
        }
        const dir = path.join(process.cwd(), "output/playwright");
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `adaptive-${count}-${width}x${height}.json`), JSON.stringify(metrics, null, 2));
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

for (const { name, width, height, options } of [...primaryPhoneCases, viewportCase(360, 640)]) {
  test(`compact disclosure keeps live stock, map panning and required actions usable at ${name}`, async ({ browser }) => {
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
      const mapViewport = page.getByRole("region", { name: "可移动地图视口", exact: true });
      await expect(page.getByRole("button", { name: "地图工具", exact: true })).toHaveCount(0);
      await mapViewport.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await measure(page)).tile.x).toBeGreaterThan(fitted.tile.x + 20);
      expect((await measure(page)).portTileRatio).toBeCloseTo(fitted.portTileRatio, 4);
      await page.keyboard.press("Home");
      await expect.poll(async () => (await measure(page)).tile.x).toBeCloseTo(fitted.tile.x, 1);
      await expect(mapViewport).toBeFocused();

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

test("opponent anchors survive breakpoints and removed live-room actions stay absent", async ({ browser }) => {
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
      await expect(run.page.getByRole("button", { name: "退出座位", exact: true })).toHaveCount(0);
      await expect(run.page.getByRole("button", { name: "在新标签页开一个座位", exact: true })).toHaveCount(0);
      await expect(run.page.getByRole("region", { name: "公开记录", exact: true })).toBeVisible();
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
    await expect(log.locator("li").first()).toHaveAttribute("data-history-key", "1-dice_rolled-0");
    await expect(log.locator("li").last()).toHaveAttribute("data-history-key", "40-dice_rolled-0");
    await expect(log).not.toContainText(/第\s*\d+\s*次操作/);
    await expect.poll(atBottom).toBe(true);
    run.push(fixture(6, 41));
    await expect(log.locator("li").last()).toHaveAttribute("data-history-key", "41-dice_rolled-0");
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
    const next = fixture(6, 42);
    run.push({ ...next, game: { ...next.game!, history: next.game!.history.slice(2) } });
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
