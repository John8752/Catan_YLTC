import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { fixture, measure, openFixture } from "./layout-fixture.js";
import { primaryPhoneCases } from "./viewport-cases.js";

async function expectReachable(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeInViewport({ ratio: 1 });
  expect(await button.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && element.contains(hit);
  })).toBe(true);
}

for (const count of [4, 6] as const) {
  test(`${count} seats keep full-height maps and bottom actions through desktop resizing`, async ({ browser }) => {
    let room = fixture(count);
    const run = await openFixture(browser, 1428, 779, room);
    const { page } = run;
    const playerAnchor = await page.locator('[data-player-target="p2"]').elementHandle();
    const ownAnchor = await page.locator('[data-player-target="p1"]').elementHandle();
    try {
      for (const [width, height] of [[1428, 779], [1366, 768], [1280, 720], [1279, 720], [1024, 768], [1366, 640]]) {
        await page.setViewportSize({ width: width!, height: height! });
        await expectReachable(page, "结束回合");
        const initial = await measure(page);
        expect(initial.overflow).toBe(false);
        expect(initial.terrainFit).toBe(true);
        expect(initial.maxPortOverflow, `${count} seats at ${width}x${height}`).toBeLessThanOrEqual(initial.tile.width * 0.2);
        expect(initial.mapScale).toBeCloseTo(1.08, 2);
        expect(initial.dock.bottom).toBeCloseTo(height! - 12, 0);
        expect(initial.sidebar.width).toBe(360);
        if (width! >= 1280) {
          expect(initial.opponents.width).toBe(200);
          expect(initial.board.height).toBe(height! - 24);
        }
        // Before-change tile widths, measured with this same deterministic fixture.
        if (width === 1024 || width === 1366 && height === 768) {
          const baseline = count === 4 ? (width === 1024 ? 69.23 : 79.11) : (width === 1024 ? 55.31 : 63.21);
          expect(initial.tile.width).toBeGreaterThanOrEqual(baseline);
        }
        const scroll = page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
        await expect.poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(3);
        await scroll.evaluate((element) => { element.scrollTop = 0; });
        await expect(page.getByRole("button", { name: "回到最新", exact: true })).toBeVisible();
        room = fixture(count, room.revision + 1);
        run.push(room);
        await expect(page.getByRole("button", { name: /有新记录/ })).toBeVisible();
        await expectReachable(page, "结束回合");
        expect((await measure(page)).dock).toEqual(initial.dock);
        await page.getByRole("button", { name: /有新记录/ }).click();
        await expect.poll(() => scroll.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(3);
        expect(await playerAnchor!.evaluate((element) => element.isConnected)).toBe(true);
        expect(await ownAnchor!.evaluate((element) => element.isConnected)).toBe(true);
      }

      await page.setViewportSize({ width: 1428, height: 779 });
      await page.locator('summary').click();
      await expectReachable(page, "结束回合");
      expect((await measure(page)).overflow).toBe(false);
      await page.locator('summary').click();
      const fitted = await measure(page);
      const mapViewport = page.getByRole("region", { name: "可移动地图视口", exact: true });
      await mapViewport.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await measure(page)).tile.x).toBeGreaterThan(fitted.tile.x + 20);
      expect((await measure(page)).portTileRatio).toBeCloseTo(fitted.portTileRatio, 4);
      await page.keyboard.press("Home");
      await expect.poll(async () => (await measure(page)).tile.x).toBeCloseTo(fitted.tile.x, 1);

      room = { ...room, revision: room.revision + 1, game: { ...room.game!, revision: room.revision + 1,
        interaction: { kind: "turn-roll", instruction: "轮到你了，请掷骰子", vertexIds: [], edgeIds: [] },
      } };
      run.push(room);
      await expectReachable(page, "掷骰子");
      await expect(page.locator('[data-player-dock]')).toHaveAttribute("data-action-attention", "required");
      const commands: unknown[] = [];
      await page.route(/\/api\/rooms\/LAYOUT\/commands$/, (route) => {
        commands.push(route.request().postDataJSON().command);
        return route.fulfill({ json: { room } });
      });
      await page.getByRole("button", { name: "掷骰子", exact: true }).click();
      await expect.poll(() => commands).toEqual([{ type: "RollDice" }]);
      await expect.poll(async () => (await measure(page)).terrainFit).toBe(true);
      await mkdir("output/playwright", { recursive: true });
      await page.screenshot({ path: `output/playwright/three-column-${count}-1428x779.png`, scale: "css", animations: "disabled" });
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}

test("primary phones preserve anchors and usable bounds as browser bars and safe areas change", async ({ browser }) => {
  for (const count of [4, 6] as const) {
    for (const full of primaryPhoneCases.filter((item) => item.name.includes("full-canvas"))) {
      const area = primaryPhoneCases.find((item) => item.name === full.name.replace("full-canvas", "browser-area"))!;
      const run = await openFixture(browser, full.width, full.height, fixture(count), full.options);
      try {
        const anchor = await run.page.locator('[data-player-target="p1"]').elementHandle();
        for (const size of [area, full]) {
          await run.page.setViewportSize({ width: size.width, height: size.height });
          // Chromium has no iPhone notch: explicitly reserve the corresponding
          // portrait/landscape space in addition to the browser-area resize.
          const portrait = size.height > size.width;
          await run.page.locator('.live-game-layout').evaluate((element, portrait) => {
            (element as HTMLElement).style.padding = portrait ? '59px 6px 34px' : '6px 59px 21px';
          }, portrait);
          const metrics = await measure(run.page);
          expect(metrics.overflow).toBe(false);
          expect(metrics.terrainFit).toBe(true);
          expect(metrics.maxPortOverflow).toBeLessThanOrEqual(metrics.tile.width * 0.2);
          expect(metrics.dock.bottom).toBeLessThanOrEqual(size.height - (portrait ? 34 : 21));
          expect(await anchor!.evaluate((element) => element.isConnected)).toBe(true);
          await run.page.getByRole("button", { name: "查看银行库存" }).click();
          await expect(run.page.getByRole("dialog")).toBeVisible();
          await run.page.keyboard.press("Escape");
        }
      } finally { await run.context.close(); }
    }
  }
});
