import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fixture, openFixture } from "./layout-fixture.js";
import { primaryPhoneCases } from "./viewport-cases.js";

const focusedSetupTipViewports = [
  "iPhone 16 portrait browser-area @primary-phone",
  "iPhone 16 landscape browser-area @primary-phone",
] as const;

for (const viewportName of focusedSetupTipViewports) {
  const viewport = primaryPhoneCases.find((candidate) => candidate.name === viewportName);
  if (viewport === undefined) throw new Error(`Missing shared viewport case: ${viewportName}`);

  test(`public setup tips for 6 players fit ${viewport.name}`, async ({ browser }) => {
    const base = fixture(6, 40);
    const loading = { ...base, setupAnalysis: { status: "loading" as const, sourceRevision: 12 } };
    const run = await openFixture(browser, viewport.width, viewport.height, loading, viewport.options);
    try {
      const predictedWinner = base.members[2] ?? base.members[0];
      if (predictedWinner === undefined) throw new Error("Missing fixture players");
      run.push({ ...base, setupAnalysis: {
        status: "ready",
        sourceRevision: 12,
        playerComments: base.members.map((player, index) => ({
          playerId: player.id,
          comment: `${player.name} 的第 ${index + 1} 套公开选点覆盖稳定点数，也给后续道路和港口规划留下了空间。`,
        })),
        predictedWinnerId: predictedWinner.id,
        prediction: `${predictedWinner.name} 的公开选点组合略占优势，不过这只是娱乐性预测，骰子和交易仍会改变局面。`,
      } });

      const dialog = run.page.getByRole("dialog");
      const tips = run.page.getByRole("region", { name: "公开开局点评" });
      await expect(dialog).toBeVisible();
      await expect(tips).toBeVisible();
      await expect(tips.locator("li")).toHaveCount(6);
      expect(await dialog.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight;
      })).toBe(true);
      expect(await run.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await mkdir("output/playwright", { recursive: true });
      const slug = viewport.name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      await run.page.screenshot({ path: `output/playwright/public-setup-tips-6-${slug}.png`, scale: "css" });
      expect(run.errors).toEqual([]);
    } finally {
      await run.context.close();
    }
  });
}

for (const viewport of [
  { name: "iPhone 16 portrait full-canvas @primary-phone", width: 393, height: 852 },
  { name: "desktop", width: 1920, height: 1021 },
] as const) {
  test(`AI commentary stays player-safe and usable at ${viewport.name}`, async ({ browser }) => {
    const room = fixture(4, 40);
    const run = await openFixture(browser, viewport.width, viewport.height, room);
    const requests: unknown[] = [];
    try {
      await run.page.route("**/api/rooms/LAYOUT/ai-commentary", async (route) => {
        const payload = route.request().postDataJSON() as { mode: string };
        requests.push(payload);
        await route.fulfill({ json: {
          mode: payload.mode,
          revision: 40,
          content: payload.mode === "prediction"
            ? "下一轮最长道路会成为争夺焦点，但骰子仍然有自己的想法。"
            : "布局验收手里的资源很热闹，桌上的道路却还在等第一铲土。",
        } });
      });

      await run.page.getByRole("button", { name: "AI 解说" }).click();
      // Opening costs nothing; every paid call is one explicit press of 生成.
      expect(requests).toEqual([]);
      await run.page.getByRole("button", { name: "生成", exact: true }).click();
      await expect(run.page.getByText("布局验收手里的资源很热闹，桌上的道路却还在等第一铲土。")).toBeVisible();

      await run.page.getByRole("radio", { name: "预测走势" }).click();
      await run.page.getByRole("button", { name: "生成", exact: true }).click();
      await expect(run.page.getByText("下一轮最长道路会成为争夺焦点，但骰子仍然有自己的想法。")).toBeVisible();

      // Appended, not replaced: the earlier read is still on screen, and above the new one.
      await expect(run.page.getByRole("log", { name: "AI 解说记录" }).getByRole("listitem")).toHaveCount(2);
      expect(await run.page.getByRole("log", { name: "AI 解说记录" }).getByRole("listitem").allInnerTexts())
        .toEqual([
          expect.stringContaining("布局验收手里的资源很热闹"),
          expect.stringContaining("下一轮最长道路会成为争夺焦点"),
        ]);

      expect(requests).toEqual([
        { seatToken: "test", expectedRevision: 40, mode: "commentary" },
        { seatToken: "test", expectedRevision: 40, mode: "prediction" },
      ]);
      expect(JSON.stringify(requests)).not.toContain("DEEPSEEK");
      expect(await run.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(run.errors).toEqual([]);
    } finally {
      await run.context.close();
    }
  });
}
