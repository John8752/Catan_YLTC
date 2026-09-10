import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createGame, executeGameCommand, resourceAmounts, type GameCommand, type GameState } from "../../../packages/game-core/src/catan.js";
import { projectGameForPlayer } from "../../../packages/protocol/src/catan/index.js";
import { fixture, openFixture } from "./fixtures.js";
import { primaryPhoneCases, viewportCase } from "../viewport-cases.js";

for (const viewport of [...primaryPhoneCases, viewportCase(1280, 800)]) {
  test(`compact trade amounts and live queue at ${viewport.name}`, async ({ browser }) => {
    const compact = viewport.width < 1024;
    const template = fixture(6);
    const base = createGame({ id: "editor-queue", seed: 42, players: template.members.map((p) => ({ ...p, name: `${p.name}的完整测试名字` })), ruleProfile: "extended-5-6" });
    let state: GameState = { ...base, revision: 1, phase: { kind: "turn", step: "action", activePlayerId: "p2", turnNumber: 1 },
      players: base.players.map((p) => ({ ...p, resources: resourceAmounts({ brick: 2, lumber: 3, wool: 4, grain: 5, ore: 6 }) })) };
    const room = () => ({ ...template, revision: state.revision, game: projectGameForPlayer(state, "p1") });
    const run = await openFixture(browser, viewport.width, viewport.height, room(), viewport.options);
    const { page } = run;
    const commands: GameCommand[] = [];
    await page.route("**/api/rooms/LAYOUT/commands", async (route) => {
      const body = route.request().postDataJSON();
      const result = executeGameCommand(state, "p1", body.command, { next: () => 0.2 });
      expect(result.accepted).toBe(true);
      commands.push(body.command);
      state = result.state;
      run.push(room());
      await route.fulfill({ json: { commandId: body.commandId, room: room() } });
    });
    try {
      const queueTrigger = page.getByRole("button", { name: "查看完整行动队列", exact: true });
      const queueDialog = page.getByRole("dialog", { name: "完整行动队列", exact: true });
      if (compact) {
        await expect(page.locator('[data-turn-queue-player]')).toHaveCount(0);
        await expect(queueTrigger).toContainText(base.players[1]!.name);
        await queueTrigger.click();
        await expect(queueDialog).toBeInViewport({ ratio: 1 });
      }
      await expect(page.locator('[data-turn-queue-player]')).toHaveCount(room().game.turnQueue.length);
      await expect(page.locator('[data-turn-queue-current]')).toHaveAttribute("data-turn-queue-player", "p2");
      state = { ...state, revision: 2, phase: { kind: "turn", step: "action", activePlayerId: "p1", turnNumber: 2 } };
      run.push(room());
      await expect(page.locator('[data-turn-queue-current]')).toHaveAttribute("data-turn-queue-player", "p1");
      await mkdir("output/playwright/trade-queue-0909", { recursive: true });
      if (compact) {
        await page.screenshot({ path: `output/playwright/trade-queue-0909/queue-${viewport.width}x${viewport.height}.png`, scale: "css" });
        await page.keyboard.press("Escape");
        await expect(queueDialog).toBeHidden();
        await expect(queueTrigger).toBeFocused();
        await expect(page.locator('[data-turn-queue-player]')).toHaveCount(0);
      }
      await expect(page.locator('[data-turn-forecast-summary]')).toHaveText("轮到你了 · 主回合");
      const opener = page.getByRole("button", { name: "发起交易", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "交易桌", exact: true });
      const publish = page.getByRole("button", { name: "向所有玩家发布报价", exact: true });
      await expect(publish).toBeDisabled();
      const giveBrick = page.getByRole("button", { name: /在我提供中加入 1 张砖/ });
      await giveBrick.click(); await giveBrick.click();
      await expect(giveBrick).toBeDisabled();
      await expect(publish).toBeEnabled(); // A one-way gift is legal.
      await page.getByRole("button", { name: /在我希望获得中加入 1 张砖/ }).click();
      await expect(publish).toBeDisabled();
      await expect(dialog).toContainText("同一种资源不能同时出现在两侧");
      if (compact) {
        const removeReceive = page.getByRole("button", { name: "从我希望获得中撤回 1 张砖" });
        await removeReceive.click(); await expect(removeReceive).toBeDisabled();
        await page.getByRole("button", { name: "从我提供中撤回 1 张砖" }).click();
        await page.getByRole("button", { name: "从我提供中撤回 1 张砖" }).click();
        await page.getByRole("button", { name: /在我希望获得中加入 1 张矿/ }).click();
        await expect(publish).toBeEnabled(); // A one-way request is also legal.
        await giveBrick.click();
        await page.getByRole("button", { name: /在我提供中加入 1 张木/ }).click();
        await page.getByRole("button", { name: /在我提供中加入 1 张羊/ }).click();
        await page.getByRole("button", { name: /在我希望获得中加入 1 张麦/ }).click();
        await expect(dialog.locator('[data-resource-card]')).toHaveCount(10);
        await expect(page.locator('[data-trade-offer-summary]')).toContainText("1砖、1木、1羊");
        // Both rows, summary, and publish fit without scrolling the editor.
        expect(await dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
        await expect(page.locator('[data-trade-amount-row="我提供"]')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('[data-trade-amount-row="我希望获得"]')).toBeInViewport({ ratio: 1 });
        await expect(publish).toBeInViewport({ ratio: 1 });
        await page.getByRole("tab", { name: "银行与港口" }).click();
        await expect(page.getByRole("button", { name: "确认银行交易" })).toBeInViewport({ ratio: 1 });
        await page.getByRole("tab", { name: "玩家协商" }).click();
        await page.keyboard.press("Escape"); await expect(opener).toBeFocused(); await opener.click();
        await expect(page.locator('[data-trade-offer-summary]')).toContainText("1砖、1木、1羊");
        // A fresh projected hand makes an unaffordable draft unavailable, without silently rewriting it.
        const previous = state;
        state = { ...state, revision: 3, players: state.players.map((p) => p.id === "p1" ? { ...p, resources: resourceAmounts() } : p) };
        run.push(room()); await expect(publish).toBeDisabled();
        state = { ...previous, revision: 4 }; run.push(room()); await expect(publish).toBeEnabled();
        await page.screenshot({ path: `output/playwright/trade-queue-0909/composer-${viewport.width}x${viewport.height}.png`, scale: "css" });
        await publish.click();
        await expect.poll(() => commands.length).toBe(1);
        expect(commands[0]).toMatchObject({ type: "OpenTradeOffer", give: resourceAmounts({ brick: 1, lumber: 1, wool: 1 }), receive: resourceAmounts({ grain: 1, ore: 1 }) });
        await expect(dialog).toBeHidden();
        await expect(page.getByRole("button", { name: /展开交易详情/ })).toBeVisible();
      } else {
        await expect(page.locator('[data-trade-amount-row]')).toHaveCount(0);
        await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1)).toBe(false);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}
