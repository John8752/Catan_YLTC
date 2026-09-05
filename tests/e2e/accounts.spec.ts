import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { iPhone16BrowserAreaCases } from "./viewport-cases.js";
import { fixture } from "./layout-fixture.js";

async function login(page: Page, username: string, password: string, register = false) {
  await page.getByRole("button", { name: "登录或注册", exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (register) await dialog.getByRole("button", { name: "注册", exact: true }).click();
  await dialog.getByLabel("用户名", { exact: false }).fill(username);
  if (register) await dialog.getByLabel("账号显示名称").fill("北岸旅人");
  await dialog.getByLabel("密码", { exact: false }).fill(password);
  await dialog.locator('button[type="submit"]').click();
}

test("account registration, wrong login, phone takeover, profile and logout preserve guest flow", async ({ browser }) => {
  const desktop = await browser.newContext();
  const phone = await browser.newContext(iPhone16BrowserAreaCases[0]!.options);
  const guest = await browser.newContext();
  const [computerPage, phonePage, guestPage] = await Promise.all([desktop.newPage(), phone.newPage(), guest.newPage()]);
  const username = `e2e_${randomUUID().replaceAll("-", "")}_long_username`;
  const password = "x";
  try {
    await computerPage.goto("/");
    await login(computerPage, username, password, true);
    await expect(computerPage.getByRole("dialog")).toHaveCount(0);
    await expect(computerPage.getByLabel("显示名称", { exact: true })).toHaveValue("北岸旅人");
    const cookie = (await desktop.cookies()).find((cookie) => cookie.name === "catan_account_session")!;
    expect(cookie.httpOnly).toBe(true); expect(cookie.secure).toBe(false); expect(cookie.sameSite).toBe("Strict");
    await computerPage.getByRole("button", { name: "创建今晚的岛" }).click();
    await expect(computerPage.locator(".room-code")).toBeVisible();
    const roomId = (await computerPage.locator(".room-code").textContent())!.trim();
    const oldSeat = await computerPage.evaluate(() => JSON.parse(localStorage.getItem("catan-yltc-seat")!));
    await guestPage.goto("/");
    await guestPage.getByLabel("显示名称", { exact: true }).fill("游客朋友");
    await guestPage.getByLabel("六位房间码").fill(roomId);
    await guestPage.getByRole("button", { name: "登岛", exact: true }).click();
    await expect(guestPage.locator(".room-code")).toBeVisible();
    await phonePage.goto("/");
    await login(phonePage, username, "wrong-password");
    await expect(phonePage.getByRole("alert")).toContainText("用户名或密码错误");
    await phonePage.getByLabel("密码", { exact: false }).fill(password);
    await phonePage.getByRole("dialog").locator('button[type="submit"]').click();
    await expect(phonePage.locator(".room-code")).toHaveText(roomId);
    await expect(computerPage.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(computerPage.getByRole("alert")).toContainText("账号登录已变更");
    const newSeat = await phonePage.evaluate(() => JSON.parse(localStorage.getItem("catan-yltc-seat")!));
    expect(newSeat.playerId).toBe(oldSeat.playerId); expect(newSeat.seatToken).not.toBe(oldSeat.seatToken);
    expect((await computerPage.request.get(`/api/rooms/${roomId}?seatToken=${oldSeat.seatToken}`)).status()).toBe(400);
    await expect(guestPage.locator(".room-code")).toHaveText(roomId);
    await phonePage.reload(); await expect(phonePage.locator(".room-code")).toHaveText(roomId);
    await phonePage.getByRole("button", { name: "我的账号", exact: true }).click();
    await expect(phonePage.getByRole("dialog")).toContainText("还没有已完成的对局");
    await phonePage.getByRole("button", { name: "修改名称", exact: true }).click();
    await phonePage.getByLabel("账号显示名称").fill("北岸新名字");
    await phonePage.getByRole("button", { name: "保存名称" }).click();
    await expect(phonePage.getByRole("status")).toContainText("显示名称已更新");
    await phonePage.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(phonePage.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect.poll(async () => phonePage.evaluate(() => localStorage.getItem("catan-yltc-seat"))).toBeNull();
    const storage = await phonePage.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(storage).not.toContain(password); expect(storage).not.toContain(cookie.value);
  } finally { await Promise.all([desktop.close(), phone.close(), guest.close()]); }
});

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...iPhone16BrowserAreaCases]) {
  test(`account history six-player long content and keyboard focus ${device.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(device.options);
    // Exercise the HTTP warning independently of localhost's secure-context exemption.
    await context.addInitScript(() => Object.defineProperty(window, "isSecureContext", { value: false }));
    const page = await context.newPage();
    const room = fixture(6, 50, true);
    const account = { id: "test-account", username: "test_account", displayName: "最长的二十四字符显示名称用于手机界面换行验收测试" };
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: { account, csrfToken: "test", activeSeat: null } }));
    await page.route("**/api/account/matches?*", (route) => route.fulfill({ json: { matches: [{ gameId: "catan", matchId: "test-match", dataVersion: 1,
      startedAt: 1, finishedAt: 1788500000000, playerId: "p1", data: { ruleProfile: "extended-5-6", victoryPointsToWin: 10,
        winnerId: "p1", players: room.members.map((member) => ({ ...member, name: account.displayName })), summary: room.game!.summary } }], nextOffset: null } }));
    try {
      await page.goto("/");
      await page.getByRole("button", { name: "我的账号", exact: true }).click();
      await expect(page.locator("details")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "赛后结算", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: `${account.displayName} 赢得群岛` })).toBeVisible();
      await expect(page.getByRole("button", { name: "查看棋盘" })).toHaveCount(0);
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("note")).toContainText("当前连接为 HTTP");
      await expect(dialog.locator(".result-player-row")).toHaveCount(6);
      await dialog.getByRole("tab", { name: "活动统计", exact: true }).click();
      await expect(dialog.getByRole("columnheader", { name: "玩家交易", exact: true })).toBeVisible();
      await dialog.getByRole("tab", { name: "骰子统计", exact: true }).click();
      await expect(dialog.getByLabel("骰子点数出现次数")).toBeVisible();
      await dialog.getByRole("tab", { name: "资源卡统计", exact: true }).click();
      await expect(dialog.getByRole("columnheader", { name: "终局", exact: true })).toBeVisible();
      await dialog.getByRole("tab", { name: "资源统计", exact: true }).click();
      await expect(dialog.getByRole("columnheader", { name: "骰产合计", exact: true })).toBeVisible();
      await dialog.getByRole("tab", { name: "概览", exact: true }).click();
      const bounds = await dialog.boundingBox(); const viewport = page.viewportSize()!;
      expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await dialog.locator(".game-result-panel").evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: testInfo.outputPath("account-history.png"), animations: "disabled", scale: "css" });
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: "我的账号", exact: true })).toBeFocused();
    } finally { await context.close(); }
  });
}

test("an expired idle account returns to login instead of trapping the user in its menu", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: {
    account: { id: "expired", username: "expired", displayName: "过期账号" }, csrfToken: "old", activeSeat: null,
  } }));
  await page.route("**/api/account/matches?*", (route) => route.fulfill({ json: { matches: [], nextOffset: null } }));
  await page.route("**/api/account/profile", (route) => route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "登录已失效" } } }));
  await page.goto("/");
  await page.getByRole("button", { name: "我的账号", exact: true }).click();
  await page.getByRole("button", { name: "修改名称", exact: true }).click();
  await page.getByLabel("账号显示名称").fill("新名字");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "登录或注册", exact: true })).toBeVisible();
});
