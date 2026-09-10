import { expect, test } from "@playwright/test";
import { fixture } from "../catan/fixtures.js";
import { iPhone16BrowserAreaCases } from "../viewport-cases.js";

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...iPhone16BrowserAreaCases]) {
  test(`@platform account history loads only the selected game's result UI ${device.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(device.options);
    const page = await context.newPage();
    const requests: string[] = [], errors: string[] = [];
    page.on("request", (request) => requests.push(new URL(request.url()).pathname));
    page.on("pageerror", (error) => errors.push(error.message));
    const account = { id: "account", username: "history_reader", displayName: "一起玩桌游" };
    const catan = fixture(6, 50, true);
    let showCatan = false;
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: { account, csrfToken: "test", activeSeat: null } }));
    await page.route("**/api/account/matches?*", (route) => {
      const gameId = new URL(route.request().url()).searchParams.get("gameId");
      const matches = gameId === "draw-guess" ? [{ gameId, matchId: "drawing-match", dataVersion: 1, startedAt: 1, finishedAt: 1788500000000, playerId: "p1",
        data: { playerCount: 6, albumCount: 6, players: Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `朋友${i + 1}的很长显示名称用于检查手机换行`, submittedPages: 5, timedOutPages: 1 })) } }]
        : showCatan ? [{ gameId: "catan", matchId: "catan-match", dataVersion: 1, startedAt: 1, finishedAt: 1788500000000, playerId: "p1",
          data: { ruleProfile: "extended-5-6", victoryPointsToWin: 10, winnerId: "p1", players: catan.members, summary: catan.game!.summary } }] : [];
      return route.fulfill({ json: { matches, nextOffset: null } });
    });
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "我的账号", exact: true }).click();
      await expect(page.getByText("还没有已完成的对局。", { exact: true })).toBeVisible();
      await page.getByLabel("记录游戏").selectOption("draw-guess");
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("传画猜词 · 6 人 · 6 本画册", { exact: true })).toBeVisible();
      await expect(dialog).toContainText("你完成了 5 页，超时收稿 1 页。");
      const catanUi = () => requests.filter((path) => /\/games\/catan\/(components\/|GameResult|AccountMatchItem|CatanTable)/.test(path));
      expect(catanUi()).toEqual([]);
      expect(requests.some((path) => path.includes("/games/draw-guess/AccountMatchItem"))).toBe(true);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      const bounds = await dialog.boundingBox(), viewport = page.viewportSize()!;
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
      await page.screenshot({ path: testInfo.outputPath("drawing-account-history.png"), animations: "disabled", scale: "css" });
      showCatan = true;
      await page.getByLabel("记录游戏").selectOption("catan");
      await expect(page.getByRole("region", { name: "赛后结算", exact: true })).toBeVisible();
      expect(catanUi().length).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: "我的账号", exact: true })).toBeFocused();
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}
