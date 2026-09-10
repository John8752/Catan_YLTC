import { expect, test, type Page, type Locator } from "@playwright/test";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";
import type { DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";

async function pixel(canvas: Locator, x = 400, y = 300) {
  return canvas.evaluate((node, point) => Array.from((node as HTMLCanvasElement).getContext("2d")!.getImageData(point.x, point.y, 1, 1).data), { x, y });
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
    for (let i = 1; i < 3; i++) sessions.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `接力朋友${i}` } })).json());
    const snapshot = async (seat: RoomSession): Promise<DrawGuessRoomView> => (await request.get(`/api/rooms/${host.roomId}?seatToken=${seat.seatToken}`)).json();
    const context = await browser.newContext(device.options);
    await context.addInitScript((seat) => localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)), host);
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto("/"); await page.getByRole("button", { name: "开始传画猜词" }).click();
      await page.getByLabel("六个候选词").getByRole("button").first().click();
      const button = (name: string) => page.getByRole("button", { name, exact: true });
      const canvas = page.getByRole("img", { name: "画布", exact: true });
      await button("选择颜色").click(); await button("红色画笔").click();
      await button("画笔").click(); await button("16 像素").click();
      await stroke(page, device.name !== "desktop", [200, 300], [600, 300]);
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
      await expect(page.getByText("草稿已保存，仅你可见", { exact: true })).toBeVisible();
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
      for (let round = 1; round < 3; round++) for (const seat of sessions) await submit(seat);
      const preview = page.getByRole("img", { name: "工具画家的画作", exact: true });
      await expect(preview).toBeVisible(); expect(await pixel(preview)).toEqual([255, 243, 191, 255]); expect(await pixel(preview, 300, 300)).toEqual(red);
      await expect(page.getByRole("article").first()).toContainText("我的题目是");
      await expect(page.getByLabel("第 1 页主持人串词")).toContainText("亲自画了第一张");
      expect(errors).toEqual([]);
    } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
  });
}
