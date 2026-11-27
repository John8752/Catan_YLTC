import { expect, test, type Page, type APIRequestContext, type Browser } from "@playwright/test";
import type { PokerRoomView, PokerAction, PokerSettings } from "../../../packages/protocol/src/texas-holdem/index.js";
import type { RoomSession } from "../../../packages/protocol/src/platform/index.js";
import { primaryPhoneCases } from "../viewport-cases.js";
import { mkdir, writeFile } from "node:fs/promises";
const defaults: PokerSettings = { mode: "fixed-hands", startingChips: 1000, smallBlind: 10, handLimit: 2, blindInterval: 5, actionSeconds: 60 };
async function snapshot(request: APIRequestContext, s: RoomSession): Promise<PokerRoomView> {
  const r = await request.get(`/api/rooms/${s.roomId}?seatToken=${s.seatToken}`); expect(r.ok()).toBe(true); return r.json();
}
async function command(request: APIRequestContext, s: RoomSession, action: PokerAction | { type: "next-hand" }) {
  const g = (await snapshot(request, s)).game!;
  const r = await request.post(`/api/rooms/${s.roomId}/texas-holdem/commands`, { data: { seatToken: s.seatToken, commandId: `e2e-${g.id}-${g.revision}-${s.playerId}`, command: { matchId: g.id, expectedRevision: g.revision, handNumber: g.handNumber, action } } });
  expect(r.ok(), await r.text()).toBe(true); expect((await r.json()).type).toBe("command_ack"); return snapshot(request, s);
}
async function setup(request: APIRequestContext, count: number, settings = defaults) {
  const host: RoomSession = await (await request.post("/api/rooms", { data: { playerName: "房主" + "长".repeat(22), gameId: "texas-holdem" } })).json();
  const seats = [host];
  for (let i = 1; i < count; i++) seats.push(await (await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: `朋友${i}长名字筹码对照` } })).json());
  const r = await snapshot(request, host);
  expect((await request.patch(`/api/rooms/${host.roomId}/texas-holdem/settings`, { data: { seatToken: host.seatToken, expectedRevision: r.revision, ...settings } })).ok()).toBe(true);
  return { host, seats };
}
async function openSeat(browser: Browser, s: RoomSession, options = {}) {
  const c = await browser.newContext(options);
  await c.addInitScript((seat) => { localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)); Object.defineProperty(crypto, "randomUUID", { value: undefined }); }, { roomId: s.roomId, playerId: s.playerId, seatToken: s.seatToken });
  const page = await c.newPage(); await page.goto("/"); return { context: c, page };
}
async function localSeat(page: Page): Promise<RoomSession> { return page.evaluate(() => JSON.parse(localStorage.getItem("catan-yltc-seat")!)); }
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test("two browsers create, raise, fold, reconnect, finish fixed hands and start a new match", async ({ browser, request }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map((c) => c.newPage())); const [host, guest] = pages as [Page, Page];
  const errors: string[] = []; pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
  let seat: RoomSession | undefined;
  try {
    await Promise.all(pages.map((p) => p.goto("/")));
    await host.getByLabel("显示名称", { exact: true }).fill("德扑房主"); await host.getByRole("radio", { name: /德州扑克/ }).check();
    await host.getByRole("button", { name: "创建德州扑克房间" }).click();
    await expect(host.getByRole("heading", { name: "等朋友，一起开桌。" })).toBeVisible(); seat = await localSeat(host);
    await guest.getByLabel("显示名称", { exact: true }).fill("朋友乙"); await guest.getByLabel("六位房间码").fill(seat.roomId); await guest.getByRole("button", { name: "加入房间", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "等朋友，一起开桌。" })).toBeVisible();
    await host.getByLabel("约定手数").fill("2"); await host.getByRole("button", { name: "保存设置", exact: true }).click(); await expect(host.getByRole("button", { name: "开始德州扑克" })).toBeEnabled();
    await host.getByRole("button", { name: "开始德州扑克" }).click();
    const first = (await snapshot(request, seat)).game!;
    await expect(host.getByRole("region", { name: "你的行动" })).toBeVisible();
    await expect(guest.getByRole("region", { name: "你的行动" })).toHaveCount(0);
    const otherSeat = await localSeat(guest), otherView = (await snapshot(request, otherSeat)).game!;
    expect(otherView.players.find((p) => p.id === seat!.playerId)!.hole).toBeNull();
    await host.getByRole("button", { name: "加注", exact: true }).click(); await host.getByLabel("加注总额", { exact: true }).fill("60");
    const receipt = host.waitForResponse(r => r.url().endsWith('/texas-holdem/commands') && r.request().method() === 'POST');
    await host.getByRole("button", { name: "确认加注" }).click();
    expect((await (await receipt).json()).type).toBe('command_ack');
    await expect(guest.getByRole("button", { name: "跟注 40", exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "弃牌", exact: true }).click();
    await expect(host.getByRole("region", { name: "本手结算" })).toBeVisible();
    await guest.reload(); await expect(guest.getByRole("region", { name: "本手结算" })).toBeVisible();
    expect((await snapshot(request, otherSeat)).game!.players.find((p) => p.id === seat!.playerId)!.hole).toBeNull();
    await host.getByRole("button", { name: "发下一手", exact: true }).click();
    await expect(guest.getByRole("region", { name: "你的行动" })).toBeVisible(); await guest.getByRole("button", { name: "弃牌", exact: true }).click();
    await host.getByRole("button", { name: "查看最终排名" }).click(); await expect(host.getByRole("region", { name: "最终排名" })).toBeAttached(); await host.keyboard.press("Escape");
    const final = (await snapshot(request, seat)).game!; expect(final.phase.kind).toBe("finished"); expect(final.players.reduce((n, p) => n + p.chips, 0)).toBe(2000);
    await host.getByRole("button", { name: "返回大厅再来一局" }).click(); await expect(guest.getByRole("heading", { name: "等朋友，一起开桌。" })).toBeVisible();
    await host.getByRole("button", { name: "开始德州扑克" }).click(); await expect(host.getByRole("region", { name: "你的行动" })).toBeVisible();
    expect((await snapshot(request, seat)).matchId).not.toBe(first.id); expect(errors).toEqual([]);
  } finally { if (seat) await request.post(`/api/rooms/${seat.roomId}/disband`, { data: { seatToken: seat.seatToken } }); await Promise.all(contexts.map((c) => c.close())); }
});

test("tournament mode plays through an all-in showdown, exposes winners and finishes", async ({ browser, request }) => {
  const { host, seats } = await setup(request, 2, { ...defaults, startingChips: 100, mode: "tournament", blindInterval: 1 });
  const { context, page } = await openSeat(browser, host); const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.getByRole("button", { name: "开始德州扑克" }).click();
    let g = (await snapshot(request, host)).game!;
    for (let hand = 0; hand < 25 && g.phase.kind !== "finished"; hand++) {
      if (g.phase.kind === "hand-over") { await page.getByRole("button", { name: "发下一手", exact: true }).click(); g = (await snapshot(request, host)).game!; }
      while (g.phase.kind === "betting") {
        const id = g.phase.actorId, actor = seats.find((s) => s.playerId === id)!, v = (await snapshot(request, actor)).game!;
        const a: PokerAction = v.legal.allIn ? { type: "all-in" } : { type: v.legal.check ? "check" : "call" };
        g = (await command(request, actor, a)).game!;
      }
    }
    expect(g.phase.kind).toBe("finished"); expect(g.result!.reason).toBe("showdown");
    await expect(page.getByRole("region", { name: "本手结算", exact: true })).toBeVisible();
    expect(g.result!.shown).toHaveLength(2); expect(g.board).toHaveLength(5);
    const board = page.getByLabel("公共牌", { exact: true }); await expect(board.getByRole("img")).toHaveCount(5);
    for (const p of g.result!.shown) expect(p.rank.cards).toHaveLength(5);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => !(a instanceof CSSTransition) && (a.playState === "running" || a.pending)).length)).toBe(0);
    await mkdir("output/playwright", { recursive: true }); await page.screenshot({ path: "output/playwright/poker-desktop-showdown.png" });
    await page.getByRole("button", { name: "查看最终排名" }).click();
    await expect(page.getByRole("heading", { name: "摊牌结算", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "最终排名", exact: true })).toBeVisible();
    await page.screenshot({ path: "output/playwright/poker-desktop-results.png" });
    expect(errors).toEqual([]);
  } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
});

for (const device of primaryPhoneCases) test(`nine-seat legible cards and dock · ${device.name}`, async ({ browser, request }) => {
  const { host, seats } = await setup(request, 9), viewer = seats[3]!;
  await request.post(`/api/rooms/${host.roomId}/start`, { data: { seatToken: host.seatToken } });
  const { context, page } = await openSeat(browser, viewer, device.options); const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  try {
    await expect(page.getByRole("region", { name: "你的行动" })).toBeVisible();
    const own = page.locator(".poker-own-hand [data-card]"); await expect(own).toHaveCount(2);
    const check = async () => {
      await noOverflow(page);
      for (const button of [page.getByRole("button", { name: "弃牌", exact: true }), page.getByRole("button", { name: "加注", exact: true })]) {
        const box = (await button.boundingBox())!; expect(box.height).toBeGreaterThanOrEqual(44); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      }
      for (const c of await own.all()) { const b = (await c.boundingBox())!; expect(b.width).toBeGreaterThanOrEqual(60); expect(b.height).toBeGreaterThanOrEqual(84); expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width); expect(await c.getAttribute("aria-label")).toMatch(/黑桃|红桃|方块|梅花/); }
      const board = (await page.getByLabel("公共牌", { exact: true }).boundingBox())!; expect(board.x).toBeGreaterThanOrEqual(0); expect(board.x + board.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      const table = (await page.getByRole("region", { name: "公共牌桌", exact: true }).boundingBox())!;
      expect(board.y).toBeGreaterThanOrEqual(table.y); expect(board.y + board.height).toBeLessThanOrEqual(table.y + table.height);
      const avatars = await page.locator("[data-poker-avatar]").all(); expect(avatars).toHaveLength(9);
      for (const badge of await page.locator("[data-poker-role]").all()) {
        await expect(badge).toHaveCSS("font-size", "12px");
        // Back cards share the avatar; they must not paint over either role character.
        expect(await badge.evaluate((element) => {
          const b = element.getBoundingClientRect();
          return [b.left + 4, b.right - 4].every((x) => {
            const top = document.elementFromPoint(x, b.top + b.height / 2);
            return top === element || element.contains(top);
          });
        })).toBe(true);
      }
      for (const avatar of avatars) {
        const b = (await avatar.boundingBox())!; expect(b.x).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        expect(b.y).toBeGreaterThanOrEqual(table.y); expect(b.y + b.height).toBeLessThanOrEqual(table.y + table.height);
        expect(b.x + b.width <= board.x || b.x >= board.x + board.width || b.y + b.height <= board.y || b.y >= board.y + board.height).toBe(true);
      }
      const pot = (await page.getByLabel("底池", { exact: true }).boundingBox())!; expect(pot.y + pot.height).toBeLessThanOrEqual(board.y);
    };
    await check();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 24, bottom: 20, left: 0, right: 0 } }); await check();
    expect(await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(24);
    expect(await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom))).toBeGreaterThanOrEqual(20);
    await mkdir("output/playwright", { recursive: true }); const slug = device.name.replace(/[^a-zA-Z0-9]+/g, "-");
    await page.screenshot({ path: `output/playwright/poker-${slug}.png` });
    if (device.name.includes("full-canvas")) {
      const area = primaryPhoneCases.find((d) => d.name.includes(device.width === 393 ? "iPhone 16 portrait browser-area" : "iPhone 16 Pro Max portrait browser-area"))!;
      await page.setViewportSize({ width: area.width, height: area.height }); await check();
    }
    await page.getByRole("button", { name: "跟注 20", exact: true }).click();
    let g = (await snapshot(request, host)).game!;
    while (g.phase.kind === "betting" && g.phase.street === "preflop") {
      const id = g.phase.actorId, actor = seats.find((s) => s.playerId === id)!, v = (await snapshot(request, actor)).game!;
      g = (await command(request, actor, { type: v.legal.check ? "check" : "call" })).game!;
    }
    await expect(page.getByLabel("公共牌", { exact: true }).getByRole("img")).toHaveCount(3);
    while (g.phase.kind === "betting" && g.phase.actorId !== viewer.playerId) {
      const actor = seats.find((s) => s.playerId === (g.phase.kind === "betting" ? g.phase.actorId : ""))!;
      g = (await command(request, actor, { type: "check" })).game!;
    }
    await expect(page.getByRole("region", { name: "你的行动" })).toBeVisible(); await check();
    await noOverflow(page);
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => !(a instanceof CSSTransition) && (a.playState === "running" || a.pending)).length)).toBe(0);
    await page.screenshot({ path: `output/playwright/poker-${slug}-flop.png` });
    await page.getByRole("button", { name: "切换牌桌配色" }).click();
    await page.screenshot({ path: `output/playwright/poker-${slug}-midnight.png` });
    await page.reload(); await expect(own).toHaveCount(2); expect(errors).toEqual([]);
  } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
});

for (const reduced of [false, true]) test(`accepted action motion, reconnect baseline and ${reduced ? "reduced" : "normal"} feedback`, async ({ browser, request }) => {
  const phone = primaryPhoneCases.find((p) => p.name.includes("iPhone 16 portrait browser-area"))!;
  const { host, seats } = await setup(request, 2), guest = seats[1]!;
  const { context, page } = await openSeat(browser, host, { ...phone.options, reducedMotion: reduced ? "reduce" : "no-preference" });
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  type Sample = { kind: string; action: string; frames: Keyframe[]; options: KeyframeAnimationOptions | number; time: number };
  type HarnessWindow = Window & { __pokerMotion: Sample[]; __pokerSockets: WebSocket[] };
  await context.addInitScript(() => {
    const w = window as unknown as HarnessWindow; w.__pokerMotion = []; w.__pokerSockets = [];
    const native = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.closest(".poker-playfield")) {
        const el = this as HTMLElement;
        w.__pokerMotion.push({ kind: el.dataset.pokerMotion ?? (el.dataset.boardIndex !== undefined ? "board" : "feedback"), action: el.dataset.action ?? el.dataset.pokerFeedback ?? "", frames: frames as Keyframe[], options: options ?? {}, time: performance.now() });
      }
      return native.call(this, frames, options);
    };
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket { constructor(url: string | URL, protocols?: string | string[]) { super(url, protocols); w.__pokerSockets.push(this); } };
  });
  await page.reload();
  const read = () => page.evaluate(() => (window as unknown as HarnessWindow).__pokerMotion);
  const settle = () => expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => !(a instanceof CSSTransition) && (a.playState === "running" || a.pending)).length), { timeout: 8000 }).toBe(0);
  const capture = async (name: string, act: () => Promise<void>) => {
    await settle();
    const directory = `output/playwright/motion/${reduced ? "reduced" : "normal"}/${name}`; await mkdir(directory, { recursive: true });
    const frames: { file: string; timeMs: number; motions: unknown[] }[] = [];
    const bounds = (await page.locator("main").boundingBox())!;
    await page.screenshot({ path: `${directory}/frame-0.png`, clip: bounds }); frames.push({ file: "frame-0.png", timeMs: -1, motions: [] });
    const start = Date.now(); await act();
    for (const [i, target] of [0, 60, 140, 280, 500, 1500, 3600].entries()) {
      const remaining = target - (Date.now() - start); if (remaining > 0) await page.waitForTimeout(remaining);
      const motions = await page.locator("[data-poker-motion]").evaluateAll((nodes) => nodes.map((el) => ({ kind: (el as HTMLElement).dataset.pokerMotion, action: (el as HTMLElement).dataset.action, opacity: getComputedStyle(el).opacity, transform: getComputedStyle(el).transform, rect: el.getBoundingClientRect().toJSON() })));
      const file = `frame-${i + 1}.png`; await page.screenshot({ path: `${directory}/${file}`, clip: bounds }); frames.push({ file, timeMs: Date.now() - start, motions });
    }
    await writeFile(`${directory}/report.json`, JSON.stringify({ source: "live isolated Playwright app", interaction: name, reducedMotion: reduced, region: bounds, setup: "Two players, fixed-hands mode, 1000 starting chips, 10/20 blinds. First-hand raise or fold after a turn bet.", frames, animations: await read(), limitations: ["Screenshot timestamps include capture overhead.", "Chromium emulation; no physical-device GPU or frame-pacing measurement."] }, null, 2));
    await writeFile(`${directory}/index.html`, `<!doctype html><meta charset="utf-8"><title>Poker ${name} ${reduced ? "reduced" : "normal"}</title><style>body{margin:20px;background:#0b1e17;color:#e5eadf;font:16px sans-serif}img{max-height:85vh;max-width:95vw;display:block}input{width:80vw}</style><h1>${name} · ${reduced ? "reduced" : "normal"}</h1><input type="range" min="0" max="7" value="0" aria-label="Frame"><p id="time">Before</p><img src="frame-0.png" alt="Poker motion frame"><script>const frames=${JSON.stringify(frames.map((f) => f.timeMs))};document.querySelector('input').oninput=e=>{const i=Number(e.target.value);document.querySelector('img').src='frame-'+i+'.png';document.querySelector('#time').textContent=i?frames[i]+' ms':'Before'}</script>`);
  };
  try {
    await page.getByRole("button", { name: "开始德州扑克" }).click();
    // The shared waiting room mounts this table on its first snapshot, which is
    // a quiet baseline. Later live hands must still animate (asserted below).
    await expect(page.getByRole("region", { name: "你的行动" })).toBeVisible();
    expect((await read()).filter((s) => s.kind === "card")).toEqual([]);
    await capture("raise", async () => { await page.getByRole("button", { name: "加注", exact: true }).click(); await page.getByLabel("加注总额", { exact: true }).fill("60"); await page.getByRole("button", { name: "确认加注", exact: true }).click(); });
    await command(request, guest, { type: "call" }); await command(request, guest, { type: "check" });
    await expect(page.getByRole("button", { name: "过牌", exact: true })).toBeVisible(); await page.getByRole("button", { name: "过牌", exact: true }).click();
    await command(request, guest, { type: "raise", to: 40 });
    await expect(page.getByRole("button", { name: "跟注 40", exact: true })).toBeVisible();
    await capture("fold", async () => { await page.getByRole("button", { name: "弃牌", exact: true }).click(); });
    await page.getByRole("button", { name: "发下一手", exact: true }).click();
    await expect.poll(async () => (await read()).filter((s) => s.kind === "card").length).toBeGreaterThan(0);
    await command(request, guest, { type: "all-in" });
    await expect(page.getByRole("button", { name: /^跟注/ })).toBeVisible(); await page.getByRole("button", { name: /^跟注/ }).click(); await settle();
    const samples = await read(), actions = new Set(samples.map((s) => s.action));
    for (const a of ["blind", "raise", "call", "check", "fold", "all-in", "award"]) expect(actions.has(a), a).toBe(true);
    expect(samples.some((s) => s.kind === "board")).toBe(true);
    expect(samples.some((s) => s.kind === "chip")).toBe(true);
    const transforms = samples.flatMap((s) => s.frames).filter((f) => f.transform !== undefined);
    expect(transforms.length > 0).toBe(!reduced);
    const before = samples.length;
    await page.evaluate(() => (window as unknown as HarnessWindow).__pokerSockets.at(-1)!.close());
    await page.waitForTimeout(1800); expect((await read()).length).toBe(before);
    await page.reload(); await expect(page.getByRole("button", { name: "查看最终排名" })).toBeVisible(); await page.waitForTimeout(500); expect(await read()).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); await request.post(`/api/rooms/${host.roomId}/disband`, { data: { seatToken: host.seatToken } }); }
});
