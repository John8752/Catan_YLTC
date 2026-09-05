import { expect, test, type WebSocketRoute } from "@playwright/test";
import { createRoomEventEncoder, ROOM_EVENT_TRANSPORT, type GameHistoryPage, type RoomView } from "../../packages/protocol/src/index.js";
import { fixture } from "./layout-fixture.js";
import { iPhone16BrowserAreaCases } from "./viewport-cases.js";

function history(afterRevision: number, throughRevision: number): GameHistoryPage {
  return { gameId: "layout_game", range: { afterRevision, throughRevision }, entries: Array.from({ length: throughRevision - afterRevision }, (_, i) => {
    const revision = afterRevision + i + 1;
    return { id: `e:${String(revision).padStart(16, "0")}:0`, revision, type: "resources_produced", privateDetail: null,
      message: `记录 ${revision} · 玩家甲 +1砖、2木；玩家乙 +3羊；玩家丙 +1麦；玩家丁 +2矿；玩家戊 +1木；布局验收 +1羊` };
  }) };
}
function view(after: number, through: number): RoomView {
  const room = fixture(6, through), page = history(after, through);
  return { ...room, game: { ...room.game!, history: page.entries, historyRange: page.range } };
}

for (const viewport of [{ name: "desktop", width: 1280, height: 800, options: {} }, ...iPhone16BrowserAreaCases]) {
  test(`history appends, pages to start, preserves reading and recovers gaps at ${viewport.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, ...viewport.options });
    await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
    const page = await context.newPage(), errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let through = 250, connections = 0, requests = 0, failNext = false;
    let socket!: WebSocketRoute, encode = createRoomEventEncoder();
    let release: (() => void) | undefined;
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: null }));
    await page.route(/\/api\/rooms\/LAYOUT\?/, (route) => route.fulfill({ json: view(through - 50, through) }));
    await page.route(/\/api\/rooms\/LAYOUT\/history\?/, async (route) => {
      const before = Number(new URL(route.request().url()).searchParams.get("beforeRevision")); requests++;
      if (requests === 1) await new Promise<void>((done) => { release = done; });
      if (failNext) { failNext = false; await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "稍后重试" } } }); return; }
      await route.fulfill({ json: history(Math.max(0, before - 51), before - 1) });
    });
    await page.routeWebSocket(/\/ws\?/, (route) => {
      expect(new URL(route.url()).searchParams.get("transport")).toBe(ROOM_EVENT_TRANSPORT);
      connections++; socket = route; encode = createRoomEventEncoder();
      route.send(JSON.stringify(encode(view(through - 50, through))));
    });
    const panel = page.getByRole("region", { name: "公开记录", exact: true });
    const scroll = panel.locator('[data-slot="scroll-area-viewport"]');
    const rows = panel.locator("[data-history-key]");
    const openPanel = async () => { if (viewport.width < 1024) await page.getByRole("button", { name: /打开公开记录与房间信息/ }).click(); };
    try {
      await page.goto("/"); await expect(page.locator(".hex-tile")).toHaveCount(30); await openPanel();
      await expect(rows).toHaveCount(50); expect(requests).toBe(0);
      await scroll.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
      await expect.poll(() => requests).toBe(1);
      const anchor = rows.filter({ hasText: "记录 201 ·" });
      const offset = (await anchor.boundingBox())!.y - (await scroll.boundingBox())!.y;
      through = 251; const live = encode(view(250, through)); socket.send(JSON.stringify(live)); socket.send(JSON.stringify(live));
      await expect(rows).toHaveCount(51); release!();
      await expect(rows).toHaveCount(101);
      // The mobile dialog itself can still be entering; compare within its scroll viewport.
      expect(Math.abs((await anchor.boundingBox())!.y - (await scroll.boundingBox())!.y - offset)).toBeLessThan(2);
      await expect(panel.getByRole("button", { name: "有新记录 · 回到最新" })).toBeVisible();
      while (await panel.getByRole("button", { name: "加载较早记录", exact: true }).count()) {
        const count = await rows.count();
        await panel.getByRole("button", { name: "加载较早记录", exact: true }).evaluate((button: HTMLButtonElement) => button.click());
        await expect.poll(() => rows.count()).toBeGreaterThan(count);
      }
      await expect(rows).toHaveCount(251); await expect(rows.first()).toContainText("记录 1 ·");
      encode(view(251, 252)); through = 253; socket.send(JSON.stringify(encode(view(252, through))));
      await expect.poll(() => connections).toBe(2); await expect(rows).toHaveCount(253);
      through = 400; socket.close();
      await expect.poll(() => connections).toBe(3);
      await expect(rows).toHaveCount(400); await expect(rows.first()).toContainText("记录 1 ·");
      await panel.getByRole("button", { name: /回到最新/ }).click();
      await expect(rows.last()).toBeInViewport();
      // A fresh tab starts with a bounded recent page; older data remains available and retryable.
      await page.reload(); await expect(page.locator(".hex-tile")).toHaveCount(30); await openPanel();
      await expect(rows).toHaveCount(50); failNext = true;
      await scroll.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
      await expect(panel.getByRole("alert")).toContainText("加载失败");
      await panel.getByRole("button", { name: "重试加载较早记录" }).click();
      await expect(rows).toHaveCount(100); await expect(panel.getByRole("alert")).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath("incremental-history.png"), scale: "css" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    } finally { release?.(); await context.close(); }
  });
}
