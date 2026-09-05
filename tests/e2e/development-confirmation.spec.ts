import { expect, test } from "@playwright/test";
import type { GameCommand } from "../../packages/protocol/src/index.js";
import { fixture, openFixture } from "./layout-fixture.js";
import { iPhone16BrowserAreaCases } from "./viewport-cases.js";

const cards = [
  { id: "confirm-knight", type: "knight", label: "骑士" },
  { id: "confirm-road", type: "road-building", label: "道路建设" },
  { id: "confirm-monopoly", type: "monopoly", label: "垄断" },
  { id: "confirm-harvest", type: "resource-choice", label: "丰收" },
] as const;
const viewports = [{ name: "desktop", width: 1280, height: 800, options: {} }, ...iPhone16BrowserAreaCases];

for (const viewport of viewports) {
  for (const card of cards) {
    test(`${card.label} requires confirmation with six players at ${viewport.name}`, async ({ browser }, testInfo) => {
      const base = fixture(6);
      const game = base.game!;
      const room = { ...base, game: { ...game, you: { ...game.you,
        developmentCards: cards.map(({ id, type }) => ({ id, type, acquiredTurn: 1 })),
      } } };
      const run = await openFixture(browser, viewport.width, viewport.height, room, viewport.options);
      const { page } = run;
      const commands: GameCommand[] = [];
      await page.route("**/api/rooms/LAYOUT/commands", async (route) => {
        const body = route.request().postDataJSON();
        commands.push(body.command);
        await route.fulfill({ json: { commandId: body.commandId, room: { ...room, revision: room.revision + 1,
          game: { ...room.game, revision: game.revision + 1, developmentCardPlayedThisTurn: true } } } });
      });
      try {
        if (viewport.width < 1024) await page.getByRole("button", { name: "展开本回合操作" }).click();
        await page.locator(".development-drawer > summary").click();
        const item = page.locator(".development-card").filter({ has: page.getByText(card.label, { exact: true }) });
        expect(await item.getByRole("combobox").count()).toBe(0);
        expect(await item.getByRole("button").count()).toBe(1);
        const trigger = item.getByRole("button", { name: "使用", exact: true });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: `确认使用${card.label}？` });
        await expect(dialog).toBeVisible();
        expect(commands).toHaveLength(0);
        await expect(dialog.getByRole("button", { name: "取消", exact: true })).toBeFocused();
        if (card.type === "monopoly") await dialog.getByRole("combobox").selectOption("brick");
        if (card.type === "resource-choice") {
          await expect(dialog.getByRole("button", { name: "确认使用" })).toBeDisabled();
          await dialog.getByRole("button", { name: /在丰收资源中加入 1 张麦/ }).click();
          await dialog.getByRole("button", { name: /在丰收资源中加入 1 张矿/ }).click();
        }
        if (card.type === "monopoly") await expect(dialog).toContainText("「砖」");
        if (card.type === "resource-choice") await expect(dialog).toContainText("「麦」和「矿」");
        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
        await page.screenshot({ path: testInfo.outputPath("development-confirmation.png"), scale: "css" });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
        expect(commands).toHaveLength(0);
        await trigger.click();
        await dialog.getByRole("button", { name: "取消", exact: true }).click();
        expect(commands).toHaveLength(0);
        await trigger.click();
        if (card.type === "resource-choice") await expect(dialog).toContainText("已选 2/2");
        await dialog.getByRole("button", { name: "确认使用", exact: true }).click();
        await expect.poll(() => commands.length).toBe(1);
        expect(commands[0]).toMatchObject({ cardId: card.id });
        if (card.type === "monopoly") expect(commands[0]).toMatchObject({ type: "PlayMonopoly", resource: "brick" });
        if (card.type === "resource-choice") expect(commands[0]).toMatchObject({ type: "PlayResourceChoice", resources: ["grain", "ore"] });
        await expect(dialog).toHaveCount(0);
        expect(run.errors).toEqual([]);
      } finally { await run.context.close(); }
    });
  }
}
