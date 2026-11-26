import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import type { CamelRoomView } from "@catan/protocol/camel-up";
import type { RoomSession } from "@catan/protocol/platform";
import { createCamelUp, RACING_CAMELS } from "../../../packages/game-core/src/camel-up/index.js";
import { projectCamelUp } from "../../../packages/protocol/src/camel-up/index.js";
import { primaryPhoneCases, iPhone14BrowserAreaCase, type ViewportCase } from "../viewport-cases.js";
async function table(request: APIRequestContext, count = 3) {
  const response = await request.post("/api/rooms", { data: { playerName: "沙漠领航员", gameId: "camel-up" } }); expect(response.ok()).toBe(true);
  const host = await response.json() as RoomSession<CamelRoomView>, seats = [host];
  for (let i = 1; i < count; i++) {
    const joined = await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `来自绿洲的远行旅客${i}` } }); expect(joined.ok()).toBe(true); seats.push(await joined.json());
  }
  return seats;
}
async function seatPage(browser: Browser, seat: RoomSession, options: ViewportCase["options"] = {}, fixture?: CamelRoomView) {
  const context = await browser.newContext(options);
  await context.addInitScript(session => localStorage.setItem("catan-yltc-seat", JSON.stringify(session)), { roomId: seat.roomId, playerId: seat.playerId, seatToken: seat.seatToken });
  const page = await context.newPage();
  if (fixture) {
    await page.route(`**/api/rooms/${seat.roomId}?*`, route => route.fulfill({ json: fixture }));
    await page.routeWebSocket("**/ws?*", socket => socket.send(JSON.stringify({ type: "room_state", room: fixture })));
  }
  await page.goto("/"); await expect(page.getByRole("heading", { name: /^骆驼大赛/ }).first()).toBeVisible(); return { context, page };
}
async function snapshot(page: Page, seat: RoomSession) {
  const response = await page.request.get(`/api/rooms/${seat.roomId}?seatToken=${encodeURIComponent(seat.seatToken)}`); expect(response.ok()).toBe(true); return await response.json() as CamelRoomView;
}
test("three seats place private bets, reconnect, finish and replay", async ({ browser, request }, info) => {
  const seats = await table(request), tabs = await Promise.all(seats.map(seat => seatPage(browser, seat)));
  try {
    const host = tabs[0]!.page, other = tabs[1]!.page;
    await host.getByRole("button", { name: "开始骆驼大赛", exact: true }).click();
    await expect(host.getByRole("heading", { name: "轮到你了" })).toBeVisible();
    const publicView = JSON.stringify(await snapshot(other, seats[1]!));
    for (const seat of seats) expect(publicView).not.toContain(seat.seatToken);
    expect(publicView).not.toContain('"seatToken"');
    expect(publicView).not.toContain('"accountId"');
    await host.getByRole("tab", { name: "终局卡" }).click();
    const receipt = host.waitForResponse(r => r.url().endsWith('/camel-up/commands') && r.request().method() === 'POST');
    await host.getByRole("button", { name: "蓝驼", exact: true }).click();
    expect((await (await receipt).json()).type).toBe('command_ack');
    await expect(host.locator("[data-camel-feedback=finish-bet]")).toContainText("秘密押注");
    await expect(other.getByRole("heading", { name: "轮到你了" })).toBeVisible();
    expect((await snapshot(other, seats[1]!)).game?.ownFinishBets).toEqual([]);
    await other.getByRole("button", { name: "领取绿驼赛段票" }).click();
    await tabs[2]!.page.getByRole("button", { name: /摇动金字塔/ }).click();
    await host.reload(); await expect(host.getByText("暗投冠军 · 蓝驼", { exact: true })).toBeVisible();
    await expect(host.locator("[data-camel-feedback]")).toHaveCount(0);
    await expect(host.getByTestId("three-arena")).toHaveAttribute("data-renderer", "three");
    await host.screenshot({ path: info.outputPath("desktop-race.png"), fullPage: true });
    let room = await snapshot(host, seats[0]!), step = 0;
    const matchId = room.matchId;
    while (room.game?.phase.kind === "racing" && step < 500) {
      const activeId = room.game.phase.activePlayerId, active = seats.find(s => s.playerId === activeId)!;
      const response = await request.post(`/api/rooms/${active.roomId}/camel-up/commands`, { data: { seatToken: active.seatToken, commandId: `finish-${step++}`, command: { type: "roll", matchId: room.matchId, expectedRevision: room.game.revision } } });
      expect(response.ok()).toBe(true); expect((await response.json()).type).toBe("command_ack"); room = await snapshot(host, seats[0]!);
    }
    expect(room.game?.phase.kind).toBe("finished");
    for (const { page } of tabs) await expect(page.getByLabel("最终金币排名")).toBeVisible();
    await host.getByRole("button", { name: "再来一局", exact: true }).click(); await host.getByRole("button", { name: "开始骆驼大赛", exact: true }).click();
    expect((await snapshot(host, seats[0]!)).matchId).not.toBe(matchId);
  } finally { for (const tab of tabs) await tab.context.close(); }
});

for (const viewport of [...primaryPhoneCases, iPhone14BrowserAreaCase]) test(`six-player portrait controls, safe areas and overflow · ${viewport.name}`, async ({ browser, request }, info) => {
  const seats = await table(request, 6), { context, page } = await seatPage(browser, seats[0]!, viewport.options);
  try {
    await page.getByRole("button", { name: "开始骆驼大赛", exact: true }).click();
    await expect(page.getByTestId("three-arena")).toHaveAttribute("data-renderer", "three");
    await expect(page.getByRole("button", { name: /摇动金字塔/ })).toBeEnabled();
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await noOverflow();
    const dock = page.getByLabel("底部行动区");
    await expect(dock).toBeVisible();
    const dockBounds = await dock.boundingBox(); expect(dockBounds!.y + dockBounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.getByRole("button", { name: "观众牌", exact: true }).click();
    const positions = page.getByLabel("按格号放观众牌"); await expect(positions).toBeVisible();
    const button = positions.getByRole("button").first(); const bounds = await button.boundingBox(); expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await button.click(); await expect(page.getByRole("dialog")).not.toBeVisible(); await expect(page.getByRole("heading", { name: "等待朋友行动" })).toBeVisible();
    await expect(page.getByTestId("three-arena")).toHaveAttribute("data-renderer", "three");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].filter(font => /YLTC/.test(font.family)).every(font => font.status === "loaded"))).toBe(true);
    await page.screenshot({ path: info.outputPath("phone-race.png"), fullPage: true, scale: "css" });
    await page.getByRole("button", { name: "玩法", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); await page.getByRole("dialog").getByRole("button", { name: "关闭" }).click();
    // Browser bars changing the available height and an explicit safe-area inset.
    await page.addStyleTag({ content: "main { padding-bottom: max(34px, env(safe-area-inset-bottom)) !important; padding-top: max(44px, env(safe-area-inset-top)) !important; }" });
    await page.setViewportSize({ width: viewport.width, height: viewport.height - 70 }); await noOverflow();
    await page.getByRole("button", { name: "房间", exact: true }).click(); await expect(page.getByRole("dialog").getByLabel("房间玩家").getByRole("listitem")).toHaveCount(6); await noOverflow();
    await page.screenshot({ path: info.outputPath("phone-room.png"), fullPage: true });
  } finally { await context.close(); }
});

for (const viewport of primaryPhoneCases.filter(item => item.name.includes("browser-area"))) test(`seven-camel stack remains fitted with reduced motion · ${viewport.name}`, async ({ browser, request }, info) => {
  const seats = await table(request, 6), host = seats[0]!;
  const state = createCamelUp("visual-stack", seats.map(seat => ({ id: seat.playerId, name: seat.room.members.find(m => m.id === seat.playerId)!.name })), { positions: [1, 1, 1, 1, 1], order: RACING_CAMELS, crazyPositions: [1, 1] });
  state.stacks = { 8: ["black", "white", ...RACING_CAMELS] };
  const fixture: CamelRoomView = { ...seats.at(-1)!.room, revision: 999, matchId: state.id, game: projectCamelUp(state, host.playerId) };
  const { context, page } = await seatPage(browser, host, { ...viewport.options, reducedMotion: "reduce" }, fixture);
  try {
    const arena = page.getByTestId("three-arena"); await expect(arena).toHaveAttribute("data-renderer", "three"); await expect(arena).toHaveAttribute("data-stack-depth", "7");
    await expect(page.getByLabel("骆驼位置").getByRole("listitem")).toHaveCount(7);
    const dock = await page.getByLabel("底部行动区").boundingBox(); expect(dock!.y + dock!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: info.outputPath("seven-camel-stack.png"), scale: "css" });
  } finally { await context.close(); }
});

test("3D camera controls and context-loss fallback preserve the playable table", async ({ browser, request }) => {
  const seats = await table(request), { context, page } = await seatPage(browser, seats[0]!, primaryPhoneCases[1]!.options);
  try {
    await page.getByRole("button", { name: "开始骆驼大赛", exact: true }).click();
    const arena = page.getByTestId("three-arena"); await expect(arena).toHaveAttribute("data-renderer", "three");
    await page.getByRole("button", { name: "放大赛场", exact: true }).click(); await page.getByRole("button", { name: "缩小赛场", exact: true }).click();
    const canvas = arena.locator("canvas"), bounds = await canvas.boundingBox();
    await page.mouse.move(bounds!.x + bounds!.width * .5, bounds!.y + bounds!.height * .5); await page.mouse.down(); await page.mouse.move(bounds!.x + bounds!.width * .7, bounds!.y + bounds!.height * .6, { steps: 8 }); await page.mouse.up();
    await page.getByRole("button", { name: "复位视角", exact: true }).click();
    await canvas.evaluate(element => {
      const gl = (element as HTMLCanvasElement).getContext("webgl2"); if (!gl) throw Error("Missing WebGL2 context");
      const extension = gl.getExtension("WEBGL_lose_context"); if (!extension) throw Error("Missing context-loss test extension"); extension.loseContext();
    });
    await expect(page.getByRole("group", { name: /16 格环形赛道/ })).toBeVisible();
    await page.getByRole("button", { name: /摇动金字塔/ }).click(); await expect(page.getByRole("heading", { name: "等待朋友行动" })).toBeVisible();
  } finally { await context.close(); }
});

test("portrait action film covers rolls, tickets, private bets, tiles, partnership and settlement", async ({ browser, request }, info) => {
  const seats = await table(request, 6), host = seats[0]!;
  const { context, page } = await seatPage(browser, host, { ...primaryPhoneCases[0]!.options, recordVideo: { dir: info.outputPath("recording"), size: { width: 393, height: 852 } } });
  const video = page.video();
  try {
    await page.getByRole("button", { name: "开始骆驼大赛", exact: true }).click();
    await expect(page.getByTestId("three-arena")).toHaveAttribute("data-renderer", "three");
    await page.getByRole("button", { name: /摇动金字塔/ }).click();
    await expect(page.locator("[data-camel-feedback=roll]")).toBeVisible(); await expect(page.locator("[data-camel-feedback]")).toHaveCount(0, { timeout: 5000 });
    let room = await snapshot(page, host);
    const actions = ["ticket", "finish-bet", "tile", "partner", "roll", "roll", "roll", "roll"] as const;
    for (const [index, type] of actions.entries()) {
      if (!room.game || room.game.phase.kind !== "racing") throw Error("Missing racing phase");
      const activeId = room.game.phase.activePlayerId;
      const seat = seats.find(s => s.playerId === activeId)!;
      const personal = await snapshot(page, seat); const legal = personal.game!.legal;
      const action = type === "ticket" ? { type, camel: legal.tickets[0]!.camel } : type === "finish-bet" ? { type, camel: legal.finishCards[0]!, kind: "winner" } : type === "tile" ? { type, space: legal.tileSpaces[0]!, side: "cheer" } : type === "partner" ? { type, playerId: legal.partners.at(-1)! } : { type };
      const response = await request.post(`/api/rooms/${seat.roomId}/camel-up/commands`, { data: { seatToken: seat.seatToken, commandId: `film-${index}`, command: { ...action, matchId: room.matchId, expectedRevision: room.game.revision } } });
      expect(response.ok()).toBe(true); expect((await response.json()).type).toBe("command_ack"); room = await snapshot(page, host);
      await expect(page.locator(`[data-camel-feedback=${type}]`)).toBeVisible(); await expect(page.locator("[data-camel-feedback]")).toHaveCount(0, { timeout: 5000 });
    }
    expect(room.game!.leg).toBe(2); await page.screenshot({ path: info.outputPath("phone-polished.png"), scale: "css" });
  } finally { await context.close(); if (video) await video.saveAs(info.outputPath("phone-actions.webm")); }
});
