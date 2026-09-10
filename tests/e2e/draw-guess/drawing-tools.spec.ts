import { expect, test, type Page, type Locator } from "@playwright/test";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";
import type { DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";

async function pixel(canvas: Locator, x = 400, y = 300) {
  return canvas.evaluate((node, point) => Array.from((node as HTMLCanvasElement).getContext("2d")!.getImageData(point.x, point.y, 1, 1).data), { x, y });
}
async function drawingFits(page: Page, bottomInset = 0) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const canvas = (await page.getByRole("img", { name: "画布", exact: true }).boundingBox())!;
  const height = page.viewportSize()!.height;
  expect(canvas.y).toBeLessThan(height * .35);
  expect(canvas.height).toBeGreaterThan(150);
  expect(canvas.width / canvas.height).toBeCloseTo(4 / 3, 2);
  for (const control of [page.getByRole("group", { name: "画笔工具" }), page.getByRole("button", { name: "完成并提交", exact: true })]) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height - bottomInset);
  }
  expect(await page.evaluate(() => scrollY)).toBe(0);
}
async function stroke(page: Page, touch: boolean, from: [number, number], to: [number, number]) {
  const canvas = page.getByRole("img", { name: "画布", exact: true }); await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const position = (x: number, y: number) => ({ x: box.x + x / 800 * box.width, y: box.y + y / 600 * box.height });
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [position(...from)] });
    for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [position(from[0] + (to[0] - from[0]) * i / 12, from[1] + (to[1] - from[1]) * i / 12)] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach();
  } else {
    const a = position(...from), b = position(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
  }
}

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...primaryPhoneCases]) {
  test(`@draw-guess drawing tools preserve erasing, history and shared background ${device.name}`, async ({ browser, request }, testInfo) => {
    const host: RoomSession = await (await request.post("/api/rooms", { data: { playerName: "工具画家", gameId: "draw-guess" } })).json();
    const sessions = [host];
    for (let i = 1; i < 6; i++) sessions.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `接力朋友${i}很长的名字` } })).json());
    const snapshot = async (seat: RoomSession): Promise<DrawGuessRoomView> => (await request.get(`/api/rooms/${host.roomId}?seatToken=${seat.seatToken}`)).json();
    const context = await browser.newContext(device.options);
    await context.addInitScript((seat) => localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)), host);
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/"); await page.getByRole("button", { name: "开始传画猜词" }).click();
      await expect(page.getByLabel("六个候选词")).toBeVisible();
      await expect(page.getByRole("dialog", { name: "选个词，再开画" })).toBeVisible();
      await expect(page.getByRole("img", { name: "画布", exact: true })).toHaveCount(0);
      const picker = page.getByRole("dialog", { name: "选个词，再开画" });
      await expect(picker.getByRole("button", { name: "关闭", exact: true })).toHaveCount(0);
      await page.keyboard.press("Escape"); await page.mouse.click(4, 4);
      await expect(picker).toBeVisible();
      await expect(page.getByRole("button", { name: "完成并提交", exact: true })).toHaveCount(0);
      const initialWords = await page.getByLabel("六个候选词").getByRole("button").allTextContents();
      const deadline = (await snapshot(host)).game!.deadline!.deadlineAt;
      await picker.getByRole("button", { name: "换一批", exact: true }).click();
      await expect.poll(async () => (await page.getByLabel("六个候选词").getByRole("button").allTextContents()).filter((word) => initialWords.includes(word))).toEqual([]);
      await expect(picker.getByRole("button", { name: "换一批", exact: true })).toBeEnabled();
      const refreshedWords = await page.getByLabel("六个候选词").getByRole("button").allTextContents();
      expect(refreshedWords).toHaveLength(6);
      expect((await snapshot(host)).game!.deadline!.deadlineAt).toBe(deadline);
      await page.reload(); await expect(picker).toBeVisible();
      expect(await page.getByLabel("六个候选词").getByRole("button").allTextContents()).toEqual(refreshedWords);
      await expect(page.getByText(/草稿/)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("opening-choices.png"), fullPage: true, scale: "css" });
      await page.getByLabel("六个候选词").getByRole("button").first().click();
      const button = (name: string) => page.getByRole("button", { name, exact: true });
      const canvas = page.getByRole("img", { name: "画布", exact: true });
      await expect(page.getByLabel("六个候选词")).toHaveCount(0);
      await button("换词").click();
      const changedWord = await page.getByLabel("六个候选词").getByRole("button").last().textContent();
      await page.getByLabel("六个候选词").getByRole("button").last().click();
      await expect(page.getByLabel("本轮题目", { exact: true })).toHaveText(changedWord!);
      await drawingFits(page);
      await page.screenshot({ path: testInfo.outputPath("drawing-viewport.png"), fullPage: true, scale: "css" });
      await page.getByRole("button", { name: /已交稿 · 房间/ }).click();
      const details = page.getByRole("dialog", { name: "房间信息", exact: true });
      await expect(details.getByRole("listitem")).toHaveCount(6);
      await expect(details.getByRole("button", { name: "解散房间", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      if (device.name.includes("full-canvas")) {
        const area = primaryPhoneCases.find((item) => item.name === device.name.replace("full-canvas", "browser-area"))!;
        const original = page.viewportSize()!;
        for (const viewport of [{ width: area.width, height: area.height }, original]) {
          await page.setViewportSize(viewport);
          // Reserve notch/home-indicator space explicitly; Chromium has no physical iPhone notch.
          await page.getByRole("main").evaluate((element) => { element.style.padding = "59px 8px 34px"; });
          await drawingFits(page, 34);
        }
        await page.getByRole("main").evaluate((element) => { element.style.removeProperty("padding"); });
      }
      await button("选择颜色").click(); await button("红色画笔").click();
      await button("画笔").click(); await button("16 像素").click();
      const submitBounds = await button("完成并提交").boundingBox();
      await stroke(page, device.name !== "desktop", [200, 300], [600, 300]);
      expect(await button("完成并提交").boundingBox()).toEqual(submitBounds);
      const red = await pixel(canvas); expect(red).not.toEqual([255, 255, 255, 255]);
      await button("橡皮擦").click(); await button("32 像素").click();
      await stroke(page, device.name !== "desktop", [400, 200], [400, 400]);
      expect(await pixel(canvas)).toEqual([255, 255, 255, 255]); expect(await pixel(canvas, 300, 300)).toEqual(red);
      await button("画布背景").click(); await button("奶黄色背景").click();
      expect(await pixel(canvas)).toEqual([255, 243, 191, 255]);
      await button("撤销").click(); expect(await pixel(canvas)).toEqual([255, 255, 255, 255]);
      await button("撤销").click(); expect(await pixel(canvas)).toEqual(red);
      await button("重做").click(); expect(await pixel(canvas)).toEqual([255, 255, 255, 255]);
      await button("重做").click(); expect(await pixel(canvas)).toEqual([255, 243, 191, 255]);
      await button("清空画布").click(); expect(await pixel(canvas, 300, 300)).toEqual([255, 243, 191, 255]);
      await expect(button("完成并提交")).toBeDisabled();
      await button("撤销").click(); expect(await pixel(canvas, 300, 300)).toEqual(red);
      await button("重做").click(); await button("撤销").click();
      await expect.poll(async () => (await snapshot(host)).game?.task?.draft?.page).toMatchObject({ background: "#fff3bf", strokes: [{ tool: "pen", width: 16 }, { tool: "eraser", width: 32 }] });
      await expect(page.getByText(/草稿/)).toHaveCount(0);
      expect(await button("完成并提交").boundingBox()).toEqual(submitBounds);
      await button("换词").click(); await expect(picker).toBeVisible(); await expect(canvas).toHaveCount(0);
      const beforeReroll = await page.getByLabel("六个候选词").getByRole("button").allTextContents();
      const commandUrl = `**/api/rooms/${host.roomId}/draw-guess/commands`;
      let dropReroll = true; const receipts: string[] = [];
      await page.route(commandUrl, async (route) => {
        const body = route.request().postDataJSON();
        if (body.command.type === "reroll") {
          receipts.push(body.commandId);
          if (dropReroll) { dropReroll = false; await route.fetch(); await route.abort("failed"); return; }
        }
        await route.continue();
      });
      await button("换一批").click();
      await expect(picker.getByRole("alert")).toContainText("换词尚未确认");
      await expect(page.getByLabel("六个候选词").getByRole("button").first()).toBeDisabled();
      const acceptedWords = (await snapshot(host)).game!.task!.suggestions;
      await button("重试换一批").click();
      await expect(button("换一批")).toBeEnabled();
      expect(receipts).toHaveLength(2); expect(receipts[0]).toBe(receipts[1]);
      const nextWords = await page.getByLabel("六个候选词").getByRole("button").allTextContents();
      expect(nextWords).toEqual(acceptedWords); expect(nextWords.some((word) => beforeReroll.includes(word))).toBe(false);
      await page.unroute(commandUrl);
      await page.reload(); await expect(picker).toBeVisible(); await expect(canvas).toHaveCount(0);
      expect(await page.getByLabel("六个候选词").getByRole("button").allTextContents()).toEqual(nextWords);
      await page.getByLabel("六个候选词").getByRole("button").first().click();
      await expect(picker).toHaveCount(0); await expect(canvas).toBeVisible();
      expect(await pixel(canvas)).toEqual([255, 243, 191, 255]); expect(await pixel(canvas, 300, 300)).toEqual(red);
      await page.reload(); await expect(canvas).toBeVisible();
      expect(await pixel(canvas)).toEqual([255, 243, 191, 255]); expect(await pixel(canvas, 300, 300)).toEqual(red);
      await expect(button("撤销")).toBeDisabled();
      await button("画布背景").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("drawing-tools.png"), fullPage: true, scale: "css" });
      await button("奶黄色背景").click(); await button("完成并提交").click();
      await expect(page.getByRole("heading", { name: "交稿成功！" })).toBeVisible();
      const submit = async (seat: RoomSession) => {
        const game = (await snapshot(seat)).game!, task = game.task!;
        if (task.submitted) return;
        const strokes = [{ color: "#222222", width: 8, points: [[20, 20], [200, 200]] }];
        const content = task.kind === "opening" ? { kind: "opening", word: task.suggestions[0]!, strokes } : task.kind === "drawing" ? { kind: "drawing", strokes } : { kind: "text", text: "猜".repeat(task.hintLength ?? 3) };
        const response = await request.post(`/api/rooms/${host.roomId}/draw-guess/commands`, { data: { seatToken: seat.seatToken, commandId: `tools-${task.id}`, command: { type: "submit", matchId: game.id, taskId: task.id, page: content } } }); expect(response.ok()).toBe(true);
      };
      for (const seat of sessions.slice(1)) await submit(seat);
      const input = (await snapshot(sessions[1]!)).game!.task!.input!;
      expect(input.kind).toBe("drawing"); expect(input).not.toHaveProperty("word");
      expect(input).toMatchObject({ background: "#fff3bf", strokes: [{ tool: "pen", width: 16 }, { tool: "eraser", width: 32 }] });
      for (let round = 1; round < sessions.length; round++) {
        if (round % 2 === 0) {
          await expect(page.getByRole("heading", { name: "把这句话画出来" })).toBeVisible();
          await drawingFits(page);
          if (round === 2) await page.screenshot({ path: testInfo.outputPath("later-drawing.png"), fullPage: true, scale: "css" });
        }
        for (const seat of sessions) await submit(seat);
      }
      const preview = page.getByRole("img", { name: "工具画家的画作", exact: true });
      await expect(preview).toBeVisible(); expect(await pixel(preview)).toEqual([255, 243, 191, 255]); expect(await pixel(preview, 300, 300)).toEqual(red);
      await expect(page.getByRole("article").first()).toContainText("我的题目是");
      await expect(page.getByLabel("第 1 页主持人串词")).toContainText("亲自画了第一张");
      expect(errors).toEqual([]);
    } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
  });
}
