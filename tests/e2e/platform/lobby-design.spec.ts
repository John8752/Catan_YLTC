import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { GAME_CATALOG, type GameType, type RoomSession } from "../../../packages/protocol/src/platform/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";
import { mkdir } from "node:fs/promises";

const devices = [{ name: "desktop", options: { viewport: { width: 1440, height: 900 } }, width: 1440, height: 900 }, ...primaryPhoneCases];
const directory = "output/playwright/lobby-design";
const slug = (s: string) => s.replace(/[^a-zA-Z0-9-]+/g, "-");
async function bounds(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  for (const element of await page.locator('input:visible, select:visible, [aria-label="开局操作"] button').all()) {
    const b = await element.boundingBox(); if (b) { expect(b.x).toBeGreaterThanOrEqual(-1); expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1); }
  }
}
async function makeRoom(request: APIRequestContext, gameId: GameType, count: number, large = false) {
  const created = await request.post("/api/rooms", { data: { playerName: "房主与朋友们的很长名字用于组桌检查", gameId } }); expect(created.ok()).toBe(true);
  const host = await created.json() as RoomSession;
  if (large) expect((await request.patch(`/api/rooms/${host.roomId}/settings`, { data: { seatToken: host.seatToken, expectedRevision: host.room.revision, ruleProfile: "extended-5-6", victoryPointsToWin: 10 } })).ok()).toBe(true);
  for (let i = 1; i < count; i++) expect((await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `朋友${i}的很长名字也需要完整可访问` } })).ok()).toBe(true);
  return host;
}

for (const device of devices) {
  test(`3D lobby switches every game and preserves direct joining ${device.name}`, async ({ browser }) => {
    const context = await browser.newContext(device.options), page = await context.newPage(), errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    try {
      await page.goto("/"); await page.getByLabel("显示名称", { exact: true }).fill("今晚一起玩");
      await page.getByLabel("六位房间码").fill("ABC123");
      await mkdir(directory, { recursive: true });
      for (const game of GAME_CATALOG) {
        await page.getByRole("radio", { name: game.name, exact: true }).check();
        await expect(page.locator('[data-world]')).toHaveAttribute("data-world", game.id);
        await expect(page.locator('[data-world]')).toHaveAttribute("data-world-status", "ready");
        await expect(page.locator('[data-world] canvas')).toHaveAttribute("data-world-frame", game.id);
        await expect(page.locator('[data-world] canvas')).toHaveAttribute("data-world-settled", "true");
        expect(await page.locator('[data-world] canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL().length)).toBeGreaterThan(10000);
        await expect(page.getByRole("button", { name: `创建${game.name}房间`, exact: true })).toBeEnabled();
        await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("今晚一起玩");
        await expect(page.getByLabel("六位房间码")).toHaveValue("ABC123");
        await bounds(page);
        if (device.name === "desktop" || game.id === "camel-up") { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${directory}/home-${game.id}-${slug(device.name)}.png`, fullPage: true, scale: "css", animations: "disabled" }); }
      }
      await page.getByRole("button", { name: "加入房间", exact: true }).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("今晚一起玩");
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });

  test(`native lobby previews keep maximum seats and actions usable ${device.name}`, async ({ browser, request }) => {
    const cases: { id: GameType; count: number; large?: boolean; hexes?: number }[] = [
      { id: "catan", count: 4, hexes: 19 }, { id: "catan", count: 6, large: true, hexes: 30 },
      { id: "draw-guess", count: 6 }, { id: "camel-up", count: 6 }, { id: "carcassonne", count: 5 }, { id: "texas-holdem", count: 9 },
    ];
    await mkdir(directory, { recursive: true });
    for (const item of cases) {
      const host = await makeRoom(request, item.id, item.count, item.large);
      const context = await browser.newContext(device.options), errors: string[] = [];
      await context.addInitScript(seat => localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)), { roomId: host.roomId, playerId: host.playerId, seatToken: host.seatToken });
      const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
      try {
        await page.goto("/");
        await expect(page.locator('[data-room-lobby]')).toHaveAttribute("data-room-lobby", item.id);
        await expect(page.getByRole("region", { name: "落座玩家", exact: true }).locator('[data-player-id]')).toHaveCount(item.count);
        await expect(page.getByLabel("房间码", { exact: true })).toHaveText(host.roomId);
        await expect(page.getByLabel("开局操作", { exact: true }).getByRole("button")).toBeEnabled();
        if (item.hexes) {
          await expect(page.locator('[data-lobby-preview] [data-hex-id]')).toHaveCount(item.hexes);
          await expect(page.locator('[data-lobby-preview] canvas')).toHaveCount(0);
          await expect(page.getByRole("button", { name: "放大地图", exact: true })).toBeVisible();
          await page.getByText("查看地图产能分析", { exact: true }).click();
          await expect(page.getByRole("region", { name: "地图产能分析", exact: true })).toBeVisible();
          await page.getByText("查看地图产能分析", { exact: true }).click();
          const before = await page.locator('.board-transform').getAttribute("style");
          await page.getByRole("button", { name: "放大地图", exact: true }).click();
          await expect.poll(() => page.locator('.board-transform').getAttribute("style")).not.toBe(before);
          await page.getByRole("button", { name: "恢复地图大小", exact: true }).click();
          await expect.poll(() => page.locator('.board-stage').evaluate(stage => {
            const rect = stage.getBoundingClientRect();
            return [...stage.querySelectorAll('[data-port-id]')].every(port => { const b = port.getBoundingClientRect(); return b.left >= rect.left - 2 && b.right <= rect.right + 2 && b.top >= rect.top - 2 && b.bottom <= rect.bottom + 2; });
          })).toBe(true);
        } else if (item.id === "draw-guess") {
          await expect(page.getByRole("img", { name: /传画猜词纸面预览/ })).toBeVisible();
          await expect(page.locator('[data-lobby-preview] canvas')).toHaveCount(0);
        } else {
          await expect(page.locator('[data-world]')).toHaveAttribute("data-world-status", "ready");
          await expect(page.locator('[data-world] canvas')).toHaveAttribute("data-world-settled", "true");
          expect(await page.locator('[data-world] canvas').evaluate(e => (e as HTMLCanvasElement).toDataURL().length)).toBeGreaterThan(10000);
        }
        await bounds(page);
        const action = await page.getByLabel("开局操作", { exact: true }).boundingBox(); expect(action!.y + action!.height).toBeLessThanOrEqual(device.height + 1);
        await page.getByRole("button", { name: "复制房间码", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: /房间码已复制|已选中房间码/ })).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `${directory}/room-${item.id}-${item.count}-${slug(device.name)}.png`, fullPage: true, scale: "css", animations: "disabled" });
        if (device.name.includes("browser-area")) {
          await page.addStyleTag({ content: '[data-room-lobby] { padding-top: 30px; } [aria-label="开局操作"] { padding-bottom: 34px; }' });
          await page.setViewportSize({ width: device.width, height: device.height - 50 }); await bounds(page);
          const button = await page.getByLabel("开局操作", { exact: true }).getByRole("button").boundingBox(); expect(button!.y + button!.height).toBeLessThanOrEqual(device.height - 50);
        }
        expect(errors).toEqual([]);
      } finally { await context.close(); }
    }
  });
}

test("WebGL unavailable and denied copy both retain working room controls", async ({ browser, request }) => {
  const context = await browser.newContext(primaryPhoneCases[1]!.options);
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind: string, ...args: unknown[]) { return kind.startsWith("webgl") ? null : Reflect.apply(original, this, [kind, ...args]); } as typeof original;
    document.execCommand = () => false;
  });
  const page = await context.newPage();
  try {
    await page.goto("/"); await expect(page.locator('[data-world]')).toHaveAttribute("data-world-status", "fallback");
    await page.getByRole("radio", { name: "骆驼大赛", exact: true }).check(); await page.getByLabel("显示名称", { exact: true }).fill("兼容模式");
    await page.getByRole("button", { name: "创建骆驼大赛房间", exact: true }).click();
    await expect(page.locator('[data-room-lobby]')).toHaveAttribute("data-room-lobby", "camel-up");
    await page.getByRole("button", { name: "复制房间码", exact: true }).click(); await expect(page.getByText("已选中房间码，可长按或按 Ctrl+C 复制")).toBeVisible();
    expect(await page.evaluate(() => getSelection()?.toString())).toMatch(/^[A-Z0-9]{6}$/);
    const seat = await page.evaluate(() => JSON.parse(localStorage.getItem("catan-yltc-seat")!)) as RoomSession;
    for (const playerName of ["朋友甲", "朋友乙"]) expect((await request.post(`/api/rooms/${seat.roomId}/join`, { data: { playerName } })).ok()).toBe(true);
    await expect(page.getByRole("button", { name: "开始骆驼大赛", exact: true })).toBeEnabled();
  } finally { await context.close(); }
});

test("reduced motion settles immediately and context loss preserves form values", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" }), page = await context.newPage();
  try {
    await page.goto("/"); await page.getByLabel("显示名称", { exact: true }).fill("慢慢玩");
    const radio = page.getByRole("radio", { name: "卡坦", exact: true }); await radio.focus(); await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "传画猜词", exact: true })).toBeChecked();
    await expect(page.locator('[data-world] canvas')).toHaveAttribute("data-world-settled", "true");
    // A viewport/screenshot resize must not expose a cleared WebGL buffer until
    // the next animation frame, even when entrance motion has already stopped.
    const resizedPixels = await page.locator('[data-world]').evaluate(root => new Promise<number>(resolve => {
      const observer = new ResizeObserver(() => { observer.disconnect(); resolve(root.querySelector('canvas')!.toDataURL().length); });
      observer.observe(root); (root as HTMLElement).style.height = `${root.getBoundingClientRect().height + 20}px`;
    }));
    expect(resizedPixels).toBeGreaterThan(10000);
    await page.locator('[data-world] canvas').evaluate(canvas => canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })));
    await expect(page.locator('[data-world]')).toHaveAttribute("data-world-status", "fallback");
    await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("慢慢玩");
    await expect(page.getByRole("button", { name: "创建传画猜词房间", exact: true })).toBeEnabled();
  } finally { await context.close(); }
});

test("every game's lobby starts its own authoritative match", async ({ browser, request }) => {
  const cases: { id: GameType; count: number; label: string }[] = [
    { id: "catan", count: 2, label: "使用当前地图开局" }, { id: "draw-guess", count: 3, label: "开始传画猜词" },
    { id: "camel-up", count: 3, label: "开始骆驼大赛" }, { id: "carcassonne", count: 2, label: "开始拼城" },
    { id: "texas-holdem", count: 2, label: "开始德州扑克" },
  ];
  for (const item of cases) {
    const host = await makeRoom(request, item.id, item.count), context = await browser.newContext();
    await context.addInitScript(seat => localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)), { roomId: host.roomId, playerId: host.playerId, seatToken: host.seatToken });
    const page = await context.newPage(), errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    try {
      await page.goto("/"); await expect(page.locator('[data-room-lobby]')).toHaveAttribute("data-room-lobby", item.id);
      if (item.id === "texas-holdem") {
        await page.getByLabel("约定手数").fill("3"); await expect(page.getByRole("button", { name: "请先保存设置", exact: true })).toBeDisabled();
        await page.getByRole("button", { name: "保存设置", exact: true }).click();
      }
      await page.getByRole("button", { name: item.label, exact: true }).click(); await expect(page.locator('[data-room-lobby]')).toHaveCount(0);
      const response = await request.get(`/api/rooms/${host.roomId}?seatToken=${host.seatToken}`), started = await response.json() as RoomSession["room"];
      expect(started.gameId).toBe(item.id); expect(started.matchId).toBeTruthy(); expect(started.game).not.toBeNull();
      if (started.gameId === "catan" && host.room.gameId === "catan") expect(started.game!.map).toEqual(host.room.previewMap);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
});
