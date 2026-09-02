import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test("lobby players can release seats and transfer or close the room", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));

  try {
    await Promise.all([host.goto("/"), guest.goto("/")]);
    await host.getByRole("textbox", { name: "显示名称" }).fill("林");
    await host.getByRole("button", { name: "创建今晚的岛" }).click();
    const roomCode = (await host.locator(".room-code").textContent())?.trim() ?? "";
    await joinRoom(guest, "岚", roomCode);
    await expect(host.getByText("2/4")).toBeVisible();

    await guest.getByRole("button", { name: "离开房间" }).click();
    await expect(guest.getByRole("dialog", { name: "确认离开房间？" })).toContainText("座位会立即释放");
    await guest.getByRole("button", { name: "确认离开" }).click();
    await expect(guest.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(host.getByText("1/4")).toBeVisible();

    await joinRoom(guest, "岚", roomCode);
    await host.getByRole("button", { name: "离开房间" }).click();
    await expect(host.getByRole("dialog", { name: "确认离开房间？" })).toContainText("房主将自动转交给 岚");
    await host.getByRole("button", { name: "确认离开" }).click();
    await expect(host.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(guest.getByText("房主可调整")).toBeVisible();
    await expect(guest.getByText("1/4")).toBeVisible();

    await guest.getByRole("button", { name: "离开房间" }).click();
    await expect(guest.getByRole("dialog", { name: "确认离开房间？" })).toContainText("房间会立即关闭");
    await guest.getByRole("button", { name: "确认离开" }).click();
    await expect(guest.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    const deletedRoom = await guest.request.get(`/api/rooms/${roomCode}?seatToken=removed`);
    expect(deletedRoom.status()).toBe(404);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

test("three isolated seats can create, join, set up, roll and reconnect", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [host, second, third] = await Promise.all(contexts.map((context) => context.newPage()));
  const pages = [host, second, third];

  try {
    await Promise.all(pages.map((page) => page.goto("/")));
    await host.getByRole("textbox", { name: "显示名称" }).fill("林");
    await host.getByRole("button", { name: "创建今晚的岛" }).click();
    const roomCode = (await host.locator(".room-code").textContent())?.trim();
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    await expect(host.getByRole("img", { name: "由十九块六边形地形组成的开局地图预览" })).toBeVisible();
    // The lobby sits in a slot that clips instead of scrolling, so the map has to
    // fit what it is given. When it sized itself instead, everything under it --
    // the production read and the zoom controls -- was pushed out of reach.
    expect(await host.evaluate(() => {
      const within = (element: Element | null) => {
        if (element === null) return "missing";
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight + 1;
      };
      return {
        analysis: within(document.querySelector('[aria-label="地图产能分析"]')),
        zoom: within(document.querySelector(".board-zoom-controls")),
      };
    })).toEqual({ analysis: true, zoom: true });
    const seedLabel = host.locator(".lobby-setup .eyebrow");
    const initialSeedLabel = await seedLabel.textContent();
    await host.getByRole("button", { name: "再次随机" }).click();
    await expect.poll(() => seedLabel.textContent()).not.toBe(initialSeedLabel);
    // Table size is one control now, and the seat cap rides on it.
    await expect(host.getByRole("button", { name: "最多 4 人" })).toHaveAttribute("aria-pressed", "true");
    expect(await host.getByRole("button", { name: "3 人", exact: true }).count()).toBe(0);
    await host.getByRole("combobox", { name: "获胜分数" }).selectOption("12");
    await expect(host.getByRole("combobox", { name: "获胜分数" })).toHaveValue("12");
    await expect(host.getByRole("combobox", { name: "银行剩余数量" })).toHaveValue("public");
    await host.getByRole("combobox", { name: "银行剩余数量" }).selectOption("hidden");
    await expect(host.getByRole("combobox", { name: "银行剩余数量" })).toHaveValue("hidden");

    await joinRoom(second, "岚", roomCode ?? "");
    await joinRoom(third, "舟", roomCode ?? "");
    await expect(host.getByText("3/4")).toBeVisible();
    await expect(second.getByRole("combobox", { name: "获胜分数" })).toHaveValue("12");
    await expect(second.getByRole("combobox", { name: "获胜分数" })).toBeDisabled();
    await expect(second.getByRole("combobox", { name: "银行剩余数量" })).toHaveValue("hidden");
    await expect(second.getByRole("combobox", { name: "银行剩余数量" })).toBeDisabled();
    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    await host.screenshot({ path: path.join(artifactDir, "e2e-lobby-settings.png"), fullPage: true });
    await host.getByRole("button", { name: "使用当前地图开局" }).click();
    await expect(host.getByRole("button", { name: "在这里放置定居点" }).first()).toBeVisible();
    for (const page of pages) {
      await expect(page.locator('[data-resource-source="bank"] [data-resource-card]')).toHaveCount(5);
      await expect(page.locator('[data-resource-source="bank"] [data-resource-count]')).toHaveCount(0);
    }
    await host.screenshot({ path: path.join(artifactDir, "e2e-setup-targets.png"), fullPage: true });
    let capturedResourceEffect = false;

    for (let placement = 0; placement < 6; placement += 1) {
      const settlementPage = await pageWithAction(pages, "在这里放置定居点");
      await clickFirstActionable(settlementPage, "在这里放置定居点");
      if (placement >= 3 && !capturedResourceEffect) {
        const flights = settlementPage.locator("[data-resource-flight]");
        if (await flights.count() > 0) {
          await expect(flights.first()).toBeVisible();
          const flightTiming = await flights.first().evaluate((element) => {
            const animation = element.getAnimations()[0];
            return {
              duration: Number(animation?.effect?.getTiming().duration ?? 0),
              currentTime: Number(animation?.currentTime ?? 0),
            };
          });
          // Bracketed rather than a lower bound: the flight was two seconds until it
          // was retuned to one, and a one-sided assertion would have gone on passing
          // while the browser played something twice as long as intended.
          expect(flightTiming.duration).toBeGreaterThanOrEqual(900);
          expect(flightTiming.duration).toBeLessThanOrEqual(1_200);
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
          await settlementPage.waitForTimeout(Math.max(0, 1_940 - flightTiming.currentTime));
          await settlementPage.screenshot({ path: path.join(artifactDir, "resource-arrival-fx.png"), fullPage: true });
          capturedResourceEffect = true;
        }
      }
      const roadPage = await pageWithAction(pages, "在这里放置道路");
      expect(roadPage).toBe(settlementPage);
      if (placement === 0) {
        await roadPage.setViewportSize({ width: 390, height: 844 });
        await clickFirstActionable(roadPage, "在这里放置道路");
        const confirmRoadDialog = roadPage.getByRole("dialog", { name: "确认道路位置" });
        await expect(confirmRoadDialog).toBeVisible();
        await roadPage.waitForTimeout(250);
        await roadPage.screenshot({ path: path.join(artifactDir, "mobile-road-confirm.png"), fullPage: true });
        await roadPage.getByRole("button", { name: "确认放置" }).click();
        await expect(confirmRoadDialog).toBeHidden();
        await roadPage.setViewportSize({ width: 1280, height: 720 });
      } else {
        await clickFirstActionable(roadPage, "在这里放置道路");
      }
    }
    expect(capturedResourceEffect).toBe(true);

    await expect(host.getByRole("button", { name: "掷骰子" })).toBeVisible();
    // Operation order no longer carries time. The same authoritative timer is
    // attached to the active player's information on every seat.
    const hostPlayerId = await host.locator('[data-current-player="true"]').getAttribute("data-player-id");
    if (hostPlayerId === null) throw new Error("Host player id is missing from the local seat");
    const ownForecast = host.locator("[data-turn-forecast]");
    const observedForecast = second.locator("[data-turn-forecast]");
    const ownRollTimer = host.locator(`[data-turn-timer-player="${hostPlayerId}"]:visible`);
    const observedRollTimer = second.locator(`[data-turn-timer-player="${hostPlayerId}"]:visible`);
    await expect(ownRollTimer).toHaveAttribute("aria-label", /掷骰倒计时/);
    await expect(observedRollTimer).toHaveAttribute("aria-label", /掷骰倒计时/);
    await expect(ownForecast.locator('[role="timer"]')).toHaveCount(0);
    await expect(observedForecast.locator('[role="timer"]')).toHaveCount(0);
    await expect(ownForecast).toHaveAttribute("data-turn-forecast-distance", "0");
    await expect(observedForecast).not.toHaveAttribute("data-turn-forecast-distance", "0");
    await Promise.all([
      host.setViewportSize({ width: 390, height: 844 }),
      second.setViewportSize({ width: 390, height: 844 }),
    ]);
    await expect(ownRollTimer).toBeVisible();
    await expect(observedRollTimer).toBeVisible();
    const ownTimerInfo = ownRollTimer.locator("xpath=ancestor::*[@data-current-player='true' or @data-seat-of][1]");
    const observedTimerInfo = observedRollTimer.locator("xpath=ancestor::*[@data-current-player='true' or @data-seat-of][1]");
    const [ownTimerBox, ownInfoBox, observedTimerBox, observedInfoBox] = await Promise.all([
      ownRollTimer.boundingBox(),
      ownTimerInfo.boundingBox(),
      observedRollTimer.boundingBox(),
      observedTimerInfo.boundingBox(),
    ]);
    if (ownTimerBox === null || ownInfoBox === null || observedTimerBox === null || observedInfoBox === null) {
      throw new Error("Missing timer layout bounds");
    }
    for (const [timer, info] of [[ownTimerBox, ownInfoBox], [observedTimerBox, observedInfoBox]] as const) {
      expect(timer.y).toBeGreaterThanOrEqual(info.y - 1);
      expect(timer.y + timer.height).toBeLessThanOrEqual(info.y + info.height + 1);
    }
    await host.screenshot({ path: path.join(artifactDir, "mobile-roll-timer.png"), fullPage: true });
    await second.screenshot({ path: path.join(artifactDir, "mobile-opponent-roll-timer.png"), fullPage: true });
    await Promise.all([
      host.setViewportSize({ width: 1280, height: 720 }),
      second.setViewportSize({ width: 1280, height: 720 }),
    ]);
    await expect(host.getByLabel(/骰子：\d \+ \d/)).toBeVisible({ timeout: 8_000 });
    const postRollTimer = host.locator(`[data-turn-timer-player="${hostPlayerId}"]:visible`);
    if (await postRollTimer.count() > 0) {
      await expect(postRollTimer).toHaveAttribute("aria-label", /操作倒计时/);
    }
    await expect(host.getByRole("img", { name: "由十九块六边形地形组成的游戏棋盘" })).toBeVisible();
    await host.screenshot({ path: path.join(artifactDir, "e2e-desktop.png"), fullPage: true });

    await second.reload();
    await expect(second.locator(".room-code")).toHaveText(roomCode ?? "");
    await expect(second.locator('[data-current-player="true"]')).toContainText("岚");

    // A seat belongs to the browser, not the tab: reopening the app finds it again,
    // which is what makes closing a tab or restarting the browser survivable.
    const reopenedTab = await contexts[0]?.newPage();
    if (reopenedTab === undefined) throw new Error("Missing host browser context");
    await reopenedTab.goto("/");
    await expect(reopenedTab.locator(".room-code")).toHaveText(roomCode ?? "");

    // Taking a second seat in the same browser is asked for explicitly.
    const extraSeatTab = await contexts[0]?.newPage();
    if (extraSeatTab === undefined) throw new Error("Missing host browser context");
    await extraSeatTab.goto("/?seat=2");
    await expect(extraSeatTab.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(extraSeatTab.locator(".room-code")).toHaveCount(0);

    await host.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect.poll(() => host.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    const opponentStrip = host.getByRole("region", { name: "座位顺序" });
    await expect(opponentStrip).toBeVisible();
    await expect.poll(() => opponentStrip.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const playerDock = host.locator(".player-dock");
    await expect(playerDock).toBeVisible();
    await expect.poll(async () => {
      const box = await playerDock.boundingBox();
      return box !== null && box.y + box.height <= 845 && box.y + box.height >= 810;
    }).toBe(true);
    const boardTransform = host.locator(".board-transform");
    const fittedTransform = await boardTransform.evaluate((element) => getComputedStyle(element).transform);
    const mapViewport = host.getByRole("region", { name: "可移动地图视口", exact: true });
    const viewportBox = await mapViewport.boundingBox();
    await host.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2);
    await host.mouse.down();
    await host.mouse.move(viewportBox!.x + viewportBox!.width / 2 + 60, viewportBox!.y + viewportBox!.height / 2 + 30, { steps: 4 });
    await host.mouse.up();
    await expect.poll(() => boardTransform.evaluate((element) => getComputedStyle(element).transform)).not.toBe(fittedTransform);
    await mapViewport.dblclick({ position: { x: 12, y: 12 } });
    await expect.poll(() => boardTransform.evaluate((element) => getComputedStyle(element).transform)).toBe(fittedTransform);
    const gameInfoTrigger = host.getByRole("button", { name: /打开公开记录与房间信息/ });
    await expect(gameInfoTrigger).toBeVisible();
    await gameInfoTrigger.click();
    const gameInfoDialog = host.getByRole("dialog", { name: "公开记录与房间信息" });
    await expect(gameInfoDialog).toBeVisible();
    await expect(host.getByRole("region", { name: "公开记录" })).toBeVisible();
    await host.waitForTimeout(250);
    await host.screenshot({ path: path.join(artifactDir, "mobile-history-sheet.png"), fullPage: true });
    await host.keyboard.press("Escape");
    await expect(gameInfoDialog).toBeHidden();
    await expect(gameInfoTrigger).toBeVisible();
    await host.screenshot({ path: path.join(artifactDir, "e2e-mobile.png"), fullPage: true });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

async function joinRoom(page: Page, name: string, roomCode: string): Promise<void> {
  await page.getByRole("textbox", { name: "显示名称" }).fill(name);
  await page.getByRole("textbox", { name: "六位房间码" }).fill(roomCode);
  await page.getByRole("button", { name: "登岛" }).click();
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
