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
    test.setTimeout(360_000);
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
      await host.getByLabel("猜词时间", { exact: true }).selectOption("90"); await expect(host.getByLabel("猜词时间", { exact: true })).toBeEnabled();
      await host.getByLabel("画画时间", { exact: true }).selectOption("120"); await expect(host.getByRole("button", { name: "开始传画猜词" })).toBeEnabled();
      await host.getByRole("button", { name: "开始传画猜词" }).click();
      const hostSeat = await seat(host); const first = await snapshot(host.request, hostSeat);
      for (let step = 0; step < 6; step++) {
        await Promise.all(pages.map(async (page, i) => {
          if (step === 0) {
            await expect(page.getByLabel("六个候选词").getByRole("button")).toHaveCount(6);
            await expect(page.getByRole("textbox")).toHaveCount(0);
            await expect(page.getByRole("button", { name: "完成并提交", exact: true })).toBeDisabled();
            await page.getByLabel("六个候选词").getByRole("button").nth(i % 6).click();
          }
          if (step % 2 === 0) { await expect(page.getByRole("img", { name: "画布", exact: true })).toBeVisible(); await draw(page); }
          else {
            await expect(page.getByLabel("字数提示", { exact: true })).toContainText(/提示：\d+ 个字/);
            const required = (await snapshot(page.request, await seat(page))).game!.task!.hintLength!;
            const input = page.getByRole("textbox", { name: "你的猜测", exact: true });
            await input.fill("猜".repeat(required + 1));
            await expect(page.getByRole("button", { name: "完成并提交", exact: true })).toBeDisabled();
            await input.fill("猜".repeat(required));
          }
        }));
        if (step === 0) {
          await expect(host.getByText("草稿已保存，仅你可见", { exact: true })).toBeVisible();
          const chosen = await host.getByLabel("六个候选词").getByRole("button", { pressed: true }).textContent();
          const before = await ink(host); await host.reload();
          await expect(host.getByLabel("六个候选词").getByRole("button", { pressed: true })).toHaveText(chosen!); await expect(host.getByRole("img", { name: "画布", exact: true })).toBeVisible(); expect(await ink(host)).toBe(before);
          await mkdir("output/playwright", { recursive: true }); await host.screenshot({ path: "output/playwright/draw-guess-six-player-drawing.png", fullPage: true });
        }
        await Promise.all(pages.map((page) => page.getByRole("button", { name: "完成并提交", exact: true }).click()));
        if (step < 5) await Promise.all(pages.map((page) => expect(page.getByText(new RegExp(`第 ${step + 2} / 6 轮`))).toBeVisible()));
      }
      await expect(host.getByText("准备好了？一起揭晓！", { exact: true })).toBeVisible();
      expect((await snapshot(host.request, hostSeat)).game?.albums).toEqual([]);
      await expect(pages[1]!.getByRole("timer", { name: "下次自动揭晓" })).toBeVisible();
      await expect(host.getByRole("button", { name: /揭晓.*页/ })).toHaveCount(0);
      await Promise.all(pages.map(async (page) => {
        const firstPage = page.getByRole("article").first();
        await firstPage.getByRole("button", { name: /^点赞/ }).click();
        await firstPage.getByRole("button", { name: /^点赞/ }).click();
        await firstPage.getByRole("button", { name: /^喝倒彩/ }).click();
      }));
      await expect.poll(async () => (await snapshot(host.request, hostSeat)).game?.albums[0]?.pages[0]?.reactions).toEqual({ up: 12, down: 6 });
      // Revealing continues with the host offline; reconnect joins the server cursor.
      await host.goto("about:blank");
      await expect.poll(async () => (await snapshot(pages[1]!.request, hostSeat)).game?.albums.flatMap((album) => album.pages).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
      await host.goto("/");
      await expect(host.getByText("系统主持人", { exact: true })).toBeVisible();
      await expect(host.getByRole("heading", { name: "本场画册已全部揭晓" })).toBeVisible({ timeout: 240_000 });
      await Promise.all(pages.map((page) => expect(page.getByRole("heading", { name: "本场画册已全部揭晓" })).toBeVisible()));
      const final = await snapshot(host.request, hostSeat); expect(final.game?.albums.flatMap((album) => album.pages)).toHaveLength(36);
      await host.getByRole("button", { name: "画册房主 的画册", exact: true }).click(); await expect(host.getByRole("article")).toHaveCount(6);
      await Promise.all(pages.map(async (page) => {
        await page.getByRole("button", { name: "画册房主 的画册", exact: true }).click();
        await page.getByRole("article").first().getByRole("button", { name: /^喝倒彩/ }).click();
      }));
      await Promise.all(pages.map((page) => expect(page.getByRole("article").first().getByRole("button", { name: "喝倒彩，12 次", exact: true })).toBeVisible()));
      // Server accepts a text-page reaction, but the HTTP response is lost. Retry must not add a second vote.
      let dropResponse = true;
      const reactionUrl = `**/api/rooms/${hostSeat.roomId}/draw-guess/commands`;
      await host.route(reactionUrl, async (route) => {
        if (dropResponse && route.request().postDataJSON().command.type === "react") {
          dropResponse = false; await route.fetch(); await route.abort("failed");
        } else await route.continue();
      });
      const textPage = host.getByRole("article").nth(1);
      await textPage.getByRole("button", { name: /^点赞/ }).click();
      await expect(host.getByRole("alert")).toContainText("表态尚未确认");
      await host.getByRole("button", { name: "重试表态", exact: true }).click();
      await expect(host.getByRole("alert")).toHaveCount(0);
      await expect(textPage.getByRole("button", { name: "点赞，1 次", exact: true })).toBeVisible();
      await host.unroute(reactionUrl);
      await pages[1]!.reload();
      await pages[1]!.getByRole("button", { name: "画册房主 的画册", exact: true }).click();
      await expect(pages[1]!.getByRole("article").nth(1).getByRole("button", { name: "点赞，1 次", exact: true })).toBeVisible();
      await host.screenshot({ path: "output/playwright/draw-guess-six-player-gallery.png", fullPage: true });
      await host.getByRole("button", { name: "回到房间，再来一局" }).click(); await expect(host.getByRole("button", { name: "开始传画猜词" })).toBeVisible();
      await host.getByRole("button", { name: "开始传画猜词" }).click(); await expect(host.getByLabel("六个候选词").getByRole("button")).toHaveCount(6); await expect(host.getByLabel("六个候选词").getByRole("button", { pressed: true })).toHaveCount(0);
      expect((await snapshot(host.request, hostSeat)).matchId).not.toBe(first.matchId); expect(errors).toEqual([]);
    } finally { await Promise.allSettled(contexts.map((context) => context.close())); }
  });

  for (const count of [4, 6]) for (const device of primaryPhoneCases) test(`opening, touch, hints and reveal with ${count} players ${device.name}`, async ({ browser, request }) => {
    const created = await request.post("/api/rooms", { data: { playerName: "最长的二十四字符显示名称用于手机界面換行验收测试", gameId: "draw-guess" } });
    const host: RoomSession = await created.json(); const sessions = [host];
    for (let i = 1; i < count; i++) sessions.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `画画朋友${i}` } })).json());
    const context = await browser.newContext(device.options); await context.addInitScript((session) => localStorage.setItem("catan-yltc-seat", JSON.stringify(session)), { roomId: host.roomId, playerId: host.playerId, seatToken: host.seatToken });
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    const slug = `${count}-players-` + device.name.replace(/[^a-zA-Z0-9]+/g, "-");
    try {
      await page.goto("/"); await expect(page.getByRole("button", { name: "开始传画猜词" })).toBeVisible();
      await mkdir("output/playwright", { recursive: true }); await page.screenshot({ path: `output/playwright/draw-guess-${slug}-lobby.png`, fullPage: true });
      await page.getByRole("button", { name: "开始传画猜词" }).click();
      const choices = page.getByLabel("六个候选词").getByRole("button");
      await expect(choices).toHaveCount(6); await choices.first().click();
      await page.screenshot({ path: `output/playwright/draw-guess-${slug}-opening.png`, fullPage: true });
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
      const submitApi = async (session: RoomSession) => {
        const game = (await snapshot(request, session)).game!, task = game.task!;
        if (task.submitted) return;
        const strokes = [{ color: "#222222", width: 8, points: [[5, 5], [50, 50]] }];
        const content = task.kind === "opening" ? { kind: "opening", word: task.suggestions[0]!, strokes } : task.kind === "drawing" ? { kind: "drawing", strokes } : { kind: "text", text: "猜".repeat(task.hintLength ?? 3) };
        expect((await request.post(`/api/rooms/${host.roomId}/draw-guess/commands`, { data: { seatToken: session.seatToken, commandId: `submit-${task.id}`, command: { type: "submit", matchId: game.id, taskId: task.id, page: content } } })).ok()).toBe(true);
      };
      for (const session of sessions.slice(1)) await submitApi(session);
      await expect(page.getByLabel("字数提示", { exact: true })).toContainText(/提示：\d+ 个字/);
      const required = (await snapshot(request, host)).game!.task!.hintLength!;
      await page.getByRole("textbox", { name: "你的猜测", exact: true }).fill("猜".repeat(required + 1));
      await expect(page.getByRole("button", { name: "完成并提交", exact: true })).toBeDisabled();
      await expect(page.getByText(/超时仍不符会记为缺页/)).toBeVisible();
      await page.getByRole("textbox", { name: "你的猜测", exact: true }).fill("猜".repeat(required));
      await expect(page.getByRole("button", { name: "完成并提交", exact: true })).toBeEnabled();
      await page.screenshot({ path: `output/playwright/draw-guess-${slug}-hint.png`, fullPage: true });
      for (let step = 1; step < count; step++) for (const session of sessions) await submitApi(session);
      await expect(page.getByRole("article")).toHaveCount(1, { timeout: 10_000 });
      await expect(page.getByRole("status").filter({ hasText: "亲自画了第一张" })).toBeVisible();
      await page.getByRole("article").first().getByRole("button", { name: /^点赞/ }).click();
      await page.getByRole("article").first().getByRole("button", { name: /^点赞/ }).click();
      await page.getByRole("article").first().getByRole("button", { name: /^喝倒彩/ }).click();
      await expect(page.getByRole("article").first().getByRole("button", { name: "点赞，2 次", exact: true })).toBeVisible();
      await expect(page.getByRole("article").first().getByRole("button", { name: "喝倒彩，1 次", exact: true })).toBeVisible();
      const narrator = (await page.getByRole("region", { name: "系统主持人串词" }).boundingBox())!;
      const entry = (await page.getByRole("article").last().boundingBox())!;
      expect(narrator.y).toBeGreaterThanOrEqual(entry.y + entry.height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `output/playwright/draw-guess-${slug}-reveal.png`, fullPage: true });
      expect(errors).toEqual([]);
    } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
  });
});
