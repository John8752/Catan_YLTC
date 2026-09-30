import { expect, test } from "@playwright/test";
import { resourceAmounts } from "../../../packages/game-core/src/catan.js";
import { fixture, openFixture } from "./fixtures.js";
import { primaryPhoneCases, viewportCase } from "../viewport-cases.js";

const phone = primaryPhoneCases.find((candidate) => candidate.name === "iPhone 16 portrait browser-area @primary-phone")!;

for (const viewport of [phone, viewportCase(1440, 900)]) {
  test(`an incoming offer opens once and later responses do not reopen it at ${viewport.name}`, async ({ browser }) => {
    const compact = viewport.width < 1024;
    const base = fixture(4);
    const run = await openFixture(browser, viewport.width, viewport.height, base, viewport.options);
    const { page } = run;
    const accept = page.getByRole("button", { name: "同意", exact: true });
    try {
      const incoming = { offerId: "incoming", proposerId: "p2", give: resourceAmounts({ ore: 1 }), receive: resourceAmounts({ brick: 1 }), responses: [] };
      const turnOfP2 = { kind: "turn" as const, activePlayerId: "p2", step: "action" as const, turnNumber: 4 };
      run.push({ ...base, revision: 41, game: { ...base.game!, revision: 41, phase: turnOfP2, openTrade: incoming } });
      await expect(accept).toBeInViewport({ ratio: 1 });
      if (compact) await expect(page.getByRole("dialog", { name: "查看报价并回应", exact: true })).toBeVisible();

      // Close it, then let other seats answer: the same offer stays closed.
      if (compact) await page.keyboard.press("Escape");
      else await page.getByRole("button", { name: "玩家甲 的报价 查看报价并回应" }).click();
      await expect(accept).toBeHidden();
      run.push({ ...base, revision: 42, game: { ...base.game!, revision: 42, phase: turnOfP2, openTrade: { ...incoming, responses: [{ playerId: "p3", response: "declined" as const }] } } });
      await expect(page.locator("#active-trade-panel")).toContainText(compact ? "1/3 已回应" : "查看报价并回应");
      await expect(accept).toBeHidden();

      // A new offer is a new prompt and opens again.
      run.push({ ...base, revision: 43, game: { ...base.game!, revision: 43, phase: turnOfP2, openTrade: { ...incoming, offerId: "incoming-2" } } });
      await expect(accept).toBeInViewport({ ratio: 1 });
      if (compact) await page.keyboard.press("Escape");

      // The local seat's own offer never opens by itself.
      run.push({ ...base, revision: 44, game: { ...base.game!, revision: 44, openTrade: { ...incoming, offerId: "own", proposerId: "p1" } } });
      await expect(page.locator("#active-trade-panel")).toHaveAttribute("aria-label", "等待桌上回应");
      await expect(page.getByRole("button", { name: "取消整份报价" })).toBeHidden();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}
