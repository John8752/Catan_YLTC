import { expect, test } from "@playwright/test";
import { resourceAmounts } from "../../../packages/game-core/src/catan.js";
import { fixture, openFixture, measure } from "./fixtures.js";
import { primaryPhoneCases, viewportCase } from "../viewport-cases.js";
import { clickGameTool, closeGameMenu } from "./game-tools.js";

for (const viewport of [...primaryPhoneCases, viewportCase(1280, 800)]) {
  test(`player details and long negotiations stay reachable at ${viewport.name}`, async ({ browser }, testInfo) => {
    const compact = viewport.width < 1024;
    const base = fixture(6);
    let room = { ...base, game: { ...base.game!, players: base.game!.players.map((p, index) => ({ ...p, name: `玩家${index + 1}的完整长名字` })) } };
    const run = await openFixture(browser, viewport.width, viewport.height, room, viewport.options);
    const { page } = run;
    try {
      const detailsTrigger = page.getByRole("button", { name: "查看玩家2的完整长名字的玩家详情" });
      await detailsTrigger.click();
      const details = page.getByRole("dialog", { name: "玩家2的完整长名字", exact: true });
      await expect(details).toBeInViewport({ ratio: 1 });
      await expect(details.getByLabel("剩余道路 15", { exact: true })).toBeVisible();
      run.push({ ...room, revision: 41, game: { ...room.game, revision: 41, players: room.game.players.map((p) => p.id === "p2" ? { ...p, playedKnights: 3 } : p) } });
      await expect(details.getByLabel("已出骑士 3", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(detailsTrigger).toBeFocused();
      if (compact) {
        await clickGameTool(page, "查看银行库存");
        await expect(page.getByRole("dialog", { name: "银行库存", exact: true })).toBeInViewport({ ratio: 1 });
        await expect(page.locator('[data-resource-source="bank"]')).toHaveCount(1);
        await page.keyboard.press("Escape");
        await closeGameMenu(page);
        expect((await measure(page)).board.height).toBeGreaterThan(290);
      }
      const offer = { offerId: "disclosure-trade", proposerId: "p1", give: resourceAmounts({ brick: 1, lumber: 1, wool: 1 }), receive: resourceAmounts({ ore: 1, grain: 1 }), responses: [] };
      room = { ...room, revision: 42, game: { ...room.game, revision: 42, openTrade: offer } };
      run.push(room);
      if (compact) {
        await expect(page.getByRole("button", { name: /展开交易详情/ })).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "结束回合", exact: true })).toBeInViewport({ ratio: 1 });
      }
      room = { ...room, revision: 43, game: { ...room.game, revision: 43, openTrade: { ...offer, responses: room.game.players.slice(1).map((p) => ({ playerId: p.id, response: "countered" as const, proposerGives: offer.give, proposerReceives: offer.receive })) } } };
      run.push(room);
      if (compact) {
        await expect(page.getByRole("button", { name: /展开交易详情/ })).toHaveAccessibleName(/5\/5 已回应/);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.getByRole("button", { name: "查看交易桌", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "等待桌上回应", exact: true })).toBeInViewport({ ratio: 1 });
        const scroll = page.locator("[data-trade-details]");
        expect(await scroll.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
        await page.getByRole("button", { name: "玩家6的完整长名字：提出反报价" }).click();
        await expect(page.getByRole("button", { name: "接受所选反报价", exact: true })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath("trade-details.png"), scale: "css" });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: /展开交易详情/ })).toBeFocused();
      } else {
        await expect(page.getByRole("button", { name: "玩家6的完整长名字：提出反报价" })).toBeVisible();
      }
      run.push({ ...room, revision: 44, game: { ...room.game, revision: 44, openTrade: null } });
      await expect(page.locator("#active-trade-panel")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "结束回合", exact: true })).toBeInViewport({ ratio: 1 });
      expect((await measure(page)).overflow).toBe(false);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}
