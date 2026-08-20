import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test("three isolated seats can create, join, set up, roll and reconnect", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [host, second, third] = await Promise.all(contexts.map((context) => context.newPage()));
  const pages = [host, second, third];

  try {
    await Promise.all(pages.map((page) => page.goto("/")));
    await host.getByRole("textbox", { name: "显示名称" }).fill("林");
    await host.getByRole("button", { name: "创建私人房间" }).click();
    const roomCode = (await host.locator(".room-code").textContent())?.trim();
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    await joinRoom(second, "岚", roomCode ?? "");
    await joinRoom(third, "舟", roomCode ?? "");
    await expect(host.getByText("3/4")).toBeVisible();
    await host.getByRole("button", { name: "生成岛屿并开局" }).click();
    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    let capturedResourceEffect = false;

    for (let placement = 0; placement < 6; placement += 1) {
      const settlementPage = await pageWithAction(pages, "在这里放置定居点");
      await clickFirstActionable(settlementPage, "在这里放置定居点");
      if (placement >= 3 && !capturedResourceEffect) {
        const flights = settlementPage.locator("[data-resource-flight]");
        if (await flights.count() > 0) {
          await expect(flights.first()).toBeVisible();
          const flightDuration = await flights.first().evaluate((element) => Number(element.getAnimations()[0]?.effect?.getTiming().duration ?? 0));
          expect(flightDuration).toBeGreaterThanOrEqual(1_100);
          const targetKey = await flights.first().getAttribute("data-resource-flight");
          await settlementPage.waitForTimeout(260);
          await settlementPage.screenshot({ path: path.join(artifactDir, "resource-production-fx.png"), fullPage: true });
          if (targetKey === null) throw new Error("Resource flight is missing its target key");
          const targetPlayerId = targetKey.split(":", 1)[0];
          if (targetPlayerId === undefined) throw new Error("Resource flight is missing its target player");
          const privateTarget = settlementPage.locator(`[data-resource-target="${targetKey}"]`);
          const target = await privateTarget.count() > 0
            ? privateTarget
            : settlementPage.locator(`[data-player-target="${targetPlayerId}"]`);
          await expect(target).toBeVisible();
          await expect.poll(() => target.evaluate((element) => element.getAnimations().length)).toBeGreaterThan(0);
          await settlementPage.waitForTimeout(170);
          await settlementPage.screenshot({ path: path.join(artifactDir, "resource-arrival-fx.png"), fullPage: true });
          capturedResourceEffect = true;
        }
      }
      const roadPage = await pageWithAction(pages, "在这里放置道路");
      expect(roadPage).toBe(settlementPage);
      await clickFirstActionable(roadPage, "在这里放置道路");
    }
    expect(capturedResourceEffect).toBe(true);

    await expect(host.getByRole("button", { name: "掷骰子" })).toBeVisible();
    await host.getByRole("button", { name: "掷骰子" }).click();
    await expect(host.getByLabel(/骰子：\d \+ \d/)).toBeVisible();
    await expect(host.getByRole("img", { name: "由十九块六边形地形组成的游戏棋盘" })).toBeVisible();
    await host.screenshot({ path: path.join(artifactDir, "e2e-desktop.png"), fullPage: true });

    await second.reload();
    await expect(second.locator(".room-code")).toHaveText(roomCode ?? "");
    await expect(second.locator('[data-current-player="true"]')).toContainText("岚");

    const extraTab = await contexts[0]?.newPage();
    if (extraTab === undefined) throw new Error("Missing host browser context");
    await extraTab.goto("/");
    await expect(extraTab.getByRole("button", { name: "创建私人房间" })).toBeVisible();
    await expect(extraTab.locator(".room-code")).toHaveCount(0);

    await host.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await host.screenshot({ path: path.join(artifactDir, "e2e-mobile.png"), fullPage: true });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

async function joinRoom(page: Page, name: string, roomCode: string): Promise<void> {
  await page.getByRole("textbox", { name: "显示名称" }).fill(name);
  await page.getByRole("textbox", { name: "六位房间码" }).fill(roomCode);
  await page.getByRole("button", { name: "加入" }).click();
  await expect(page.locator(".room-code")).toHaveText(roomCode);
}

async function pageWithAction(pages: readonly Page[], accessibleName: string): Promise<Page> {
  let match: Page | undefined;
  await expect.poll(async () => {
    for (const page of pages) {
      if (await page.getByRole("button", { name: accessibleName }).count() > 0) {
        match = page;
        return true;
      }
    }
    return false;
  }).toBe(true);
  if (match === undefined) throw new Error(`No page can perform ${accessibleName}`);
  return match;
}

async function clickFirstActionable(page: Page, accessibleName: string): Promise<void> {
  const candidates = page.getByRole("button", { name: accessibleName });
  const count = await candidates.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    try {
      await candidate.click({ trial: true, timeout: 800 });
      await candidate.click({ timeout: 2_000 });
      return;
    } catch {
      // A port or an existing piece can geometrically cover one SVG target; try another legal target.
    }
  }
  throw new Error(`No pointer-actionable target for ${accessibleName}`);
}
