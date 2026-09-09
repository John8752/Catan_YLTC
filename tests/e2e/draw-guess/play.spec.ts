import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import type { DrawGuessRoomView } from "../../../packages/protocol/src/draw-guess/index.js";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";
import { mkdir } from "node:fs/promises";

async function snapshot(request: APIRequestContext, session: RoomSession): Promise<DrawGuessRoomView> {
  const response = await request.get(`/api/rooms/${session.roomId}?seatToken=${session.seatToken}`); expect(response.ok()).toBe(true); return response.json();
}
async function seat(page: Page): Promise<RoomSession> { return page.evaluate(() => JSON.parse(localStorage.getItem("catan-yltc-seat")!)); }
async function draw(page: Page) {
  const canvas = page.getByRole("img", { name: "画布", exact: true }); await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .3); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .6, { steps: 14 }); await page.mouse.up();
}
async function ink(page: Page) {
  return page.getByRole("img", { name: "画布", exact: true }).evaluate((canvas) => {
    const pixels = (canvas as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 800, 600).data;
    let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! < 150) count++; return count;
  });
}
test.describe("@draw-guess", () => {
  test("six independent browsers complete a round, recover a drawing, reveal together and replay", async ({ browser }) => {
    test.setTimeout(180_000);
    const contexts = await Promise.all(Array.from({ length: 6 }, () => browser.newContext()));
    const pages = await Promise.all(contexts.map((context) => context.newPage())); const host = pages[0]!;
    const errors: string[] = []; for (const page of pages) page.on("pageerror", (error) => errors.push(error.message));
    try {
      await Promise.all(pages.map((page) => page.goto("/")));
      await host.getByLabel("显示名称", { exact: true }).fill("画册房主");
      await host.getByRole("radio", { name: /传画猜词/ }).check(); await host.getByRole("button", { name: "创建传画猜词房间" }).click();
      await expect(host.getByLabel("房间码", { exact: true })).toBeVisible(); const roomId = (await host.getByLabel("房间码", { exact: true }).textContent())!;
      await Promise.all(pages.slice(1).map(async (page, i) => { await page.getByLabel("显示名称", { exact: true }).fill(`朋友${i + 1}`); await page.getByLabel("六位房间码").fill(roomId); await page.getByRole("button", { name: "登岛", exact: true }).click(); }));
      await expect(host.getByText("等待朋友加入 · 6/6 人")).toBeVisible();
      await host.getByLabel("写词 / 猜词时间", { exact: true }).selectOption("90"); await expect(host.getByLabel("写词 / 猜词时间", { exact: true })).toBeEnabled();
      await host.getByLabel("画画时间", { exact: true }).selectOption("120"); await expect(host.getByRole("button", { name: "开始传画猜词" })).toBeEnabled();
      await host.getByRole("button", { name: "开始传画猜词" }).click();
      const hostSeat = await seat(host); const first = await snapshot(host.request, hostSeat);
      for (let step = 0; step < 6; step++) {
        await Promise.all(pages.map(async (page, i) => {
          if (step % 2) { await expect(page.getByRole("img", { name: "画布", exact: true })).toBeVisible(); await draw(page); }
          else await page.getByRole("textbox", { name: step === 0 ? "你的词语" : "你的猜测", exact: true }).fill(`第${step}轮朋友${i}独有的脑洞`);
        }));
        if (step === 1) {
          await expect(host.getByText("草稿已保存，仅你可见", { exact: true })).toBeVisible();
          const before = await ink(host); await host.reload(); await expect(host.getByRole("img", { name: "画布", exact: true })).toBeVisible(); expect(await ink(host)).toBe(before);
          await mkdir("output/playwright", { recursive: true }); await host.screenshot({ path: "output/playwright/draw-guess-six-player-drawing.png", fullPage: true });
        }
        await Promise.all(pages.map((page) => page.getByRole("button", { name: "完成并提交", exact: true }).click()));
        if (step < 5) await Promise.all(pages.map((page) => expect(page.getByText(new RegExp(`第 ${step + 2} / 6 轮`))).toBeVisible()));
      }
      await expect(host.getByRole("button", { name: "揭晓第一页" })).toBeVisible();
      expect((await snapshot(host.request, hostSeat)).game?.albums).toEqual([]);
      await expect(pages[1]!.getByText("等待房主揭晓下一页…")).toBeVisible();
      for (let cursor = 0; cursor < 36; cursor++) {
        const response = host.waitForResponse((response) => response.url().endsWith("/draw-guess/commands") && response.request().method() === "POST");
        await host.getByRole("button", { name: cursor === 0 ? "揭晓第一页" : "揭晓下一页", exact: true }).click();
        expect((await response).ok()).toBe(true);
      }
      await Promise.all(pages.map((page) => expect(page.getByRole("heading", { name: "这一轮，画得太离谱了" })).toBeVisible()));
      const final = await snapshot(host.request, hostSeat); expect(final.game?.albums.flatMap((album) => album.pages)).toHaveLength(36);
      await host.getByRole("button", { name: "画册房主 的画册", exact: true }).click(); await expect(host.getByRole("article")).toHaveCount(6);
      await host.screenshot({ path: "output/playwright/draw-guess-six-player-gallery.png", fullPage: true });
      await host.getByRole("button", { name: "回到房间，再来一局" }).click(); await expect(host.getByRole("button", { name: "开始传画猜词" })).toBeVisible();
      await host.getByRole("button", { name: "开始传画猜词" }).click(); await expect(host.getByLabel("你的词语", { exact: true })).toHaveValue("");
      expect((await snapshot(host.request, hostSeat)).matchId).not.toBe(first.matchId); expect(errors).toEqual([]);
    } finally { await Promise.allSettled(contexts.map((context) => context.close())); }
  });

  for (const device of primaryPhoneCases) test(`touch canvas and refresh ${device.name}`, async ({ browser, request }) => {
    const created = await request.post("/api/rooms", { data: { playerName: "最长的二十四字符显示名称用于手机界面換行验收测试", gameId: "draw-guess" } });
    const host: RoomSession = await created.json(); const sessions = [host];
    for (let i = 1; i < 6; i++) sessions.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `画画朋友${i}` } })).json());
    const context = await browser.newContext(device.options); await context.addInitScript((session) => localStorage.setItem("catan-yltc-seat", JSON.stringify(session)), { roomId: host.roomId, playerId: host.playerId, seatToken: host.seatToken });
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    const slug = device.name.replace(/[^a-zA-Z0-9]+/g, "-");
    try {
      await page.goto("/"); await expect(page.getByRole("button", { name: "开始传画猜词" })).toBeVisible();
      await mkdir("output/playwright", { recursive: true }); await page.screenshot({ path: `output/playwright/draw-guess-${slug}-lobby.png`, fullPage: true });
      await page.getByRole("button", { name: "开始传画猜词" }).click();
      for (const session of sessions) {
        const game = (await snapshot(request, session)).game!;
        expect((await request.post(`/api/rooms/${host.roomId}/draw-guess/commands`, { data: { seatToken: session.seatToken, commandId: "prompt", command: { type: "submit", matchId: game.id, taskId: game.task!.id, page: { kind: "text", text: "企鹅骑自行车" } } } })).ok()).toBe(true);
      }
      const canvas = page.getByRole("img", { name: "画布", exact: true }); await expect(canvas).toBeVisible(); await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!; const scroll = await page.evaluate(() => scrollY);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 40, y: box.y + 40 }] });
      for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 40 + i * 10, y: box.y + 40 + i * 6 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      expect(await ink(page)).toBeGreaterThan(100); expect(await page.evaluate(() => scrollY)).toBe(scroll);
      await expect(page.getByText("草稿已保存，仅你可见", { exact: true })).toBeVisible();
      await page.reload(); await expect(canvas).toBeVisible(); expect(await ink(page)).toBeGreaterThan(100);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `output/playwright/draw-guess-${slug}-canvas.png`, fullPage: true });
      await page.getByRole("button", { name: "完成并提交", exact: true }).click(); await expect(page.getByRole("heading", { name: "交稿成功！" })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
  });
});
