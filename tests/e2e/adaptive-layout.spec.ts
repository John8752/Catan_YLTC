import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createGame, resourceAmounts, type GameState, type PlayerSeed, type GameEventRecord } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, test, type Browser, type Page, type WebSocketRoute } from "@playwright/test";

const players: PlayerSeed[] = [
  { id: "p1", name: "布局验收", color: "terracotta" },
  { id: "p2", name: "玩家甲", color: "ocean" },
  { id: "p3", name: "玩家乙", color: "pine" },
  { id: "p4", name: "玩家丙", color: "wheat" },
  { id: "p5", name: "玩家丁", color: "plum" },
  { id: "p6", name: "玩家戊", color: "charcoal" },
];
const sizes = [
  [1024, 768], [1366, 768], [1920, 1021], [2560, 1440], [3840, 2160],
  [3440, 1440], [1920, 720], [960, 540], [390, 844], [360, 640],
] as const;

function fixture(count: 4 | 6, revision = 40, finished = false): RoomView {
  const base = createGame({ id: "layout_game", seed: 93357307, players: players.slice(0, count), ruleProfile: count === 6 ? "extended-5-6" : "base-3-4" });
  const state: GameState = {
    ...base, revision, phase: finished ? { kind: "finished", winnerId: "p1" } : { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    lastRoll: [2, 3],
    players: base.players.map((player) => ({ ...player, resources: resourceAmounts({ brick: 2, lumber: 3, wool: 4, grain: 5, ore: 6 }) })),
  };
  const records: GameEventRecord[] = Array.from({ length: revision }, (_, i) => ({ revision: i + 1, event: { type: "dice_rolled", playerId: "p1", dice: [2, 3] } }));
  const projected = projectGameForPlayer(state, "p1", records);
  return {
    id: "LAYOUT", revision, hostPlayerId: "p1", previewMap: null,
    members: players.slice(0, count).map((p) => ({ ...p, isHost: p.id === "p1" })),
    settings: { ruleProfile: count === 6 ? "extended-5-6" : "base-3-4", playerLimit: count, victoryPointsToWin: 10, mapSeed: state.seed },
    game: { ...projected, effects: [], history: projected.history.map((e) => ({ ...e, message: `第 ${e.revision} 次操作：布局验收掷出 2 + 3，其他玩家获得资源。` })) },
  };
}

async function openFixture(browser: Browser, width: number, height: number, room: RoomView, deviceScaleFactor = 1) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/api\/rooms\/LAYOUT\?/, (route) => route.fulfill({ json: room }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => { socket = route; });
  await page.goto("/");
  await expect(page.locator(".hex-tile")).toHaveCount(room.game?.map.hexes.length ?? 0);
  await expect.poll(() => socket !== undefined).toBe(true);
  return { context, page, errors, push: (next: RoomView) => socket!.send(JSON.stringify({ type: "room_state", room: next })) };
}

test("history appends below, follows live updates, preserves reading and reopens at the latest", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(6));
  const log = run.page.getByRole("log");
  const scroll = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
  const atBottom = () => scroll.evaluate((e) => e.scrollHeight - e.clientHeight - e.scrollTop < 3);
  try {
    await expect(log.locator("li").first()).toContainText("第 11 次操作");
    await expect(log.locator("li").last()).toContainText("第 40 次操作");
    await expect.poll(atBottom).toBe(true);
    run.push(fixture(6, 41));
    await expect(log.locator("li").last()).toContainText("第 41 次操作");
    await expect.poll(atBottom).toBe(true);
    await scroll.evaluate((e) => { e.scrollTop = 0; });
    await expect(run.page.getByRole("button", { name: "回到最新", exact: true })).toBeVisible();
    run.push(fixture(6, 42));
    await expect(run.page.getByRole("button", { name: /有新记录/ })).toBeVisible();
    expect(await atBottom()).toBe(false);
    await run.page.getByRole("button", { name: /有新记录/ }).click();
    await expect.poll(atBottom).toBe(true);
    await run.page.setViewportSize({ width: 390, height: 844 });
    await run.page.getByRole("button", { name: /打开公开记录与房间信息/ }).click();
    await expect(run.page.getByRole("dialog", { name: "公开记录与房间信息" })).toBeVisible();
    await expect.poll(atBottom).toBe(true);
    await run.page.keyboard.press("Escape");
    await expect(run.page.getByRole("dialog")).toHaveCount(0);
    expect(run.errors).toEqual([]);
  } finally { await run.context.close(); }
});

test("history keeps the same visible entry when retention drops older rows", async ({ browser }) => {
  const run = await openFixture(browser, 1920, 1021, fixture(6));
  const scroll = run.page.getByRole("region", { name: "公开记录", exact: true }).locator('[data-slot="scroll-area-viewport"]');
  try {
    await scroll.evaluate((e) => { e.scrollTop = 500; });
    await expect(run.page.getByRole("button", { name: "回到最新", exact: true })).toBeVisible();
    const reading = await scroll.evaluate((e) => {
      const row = [...e.querySelectorAll<HTMLElement>("li")].find((r) => r.getBoundingClientRect().bottom > e.getBoundingClientRect().top)!;
      return { key: row.dataset.historyKey, offset: row.getBoundingClientRect().top - e.getBoundingClientRect().top };
    });
    run.push(fixture(6, 42));
    await expect(run.page.getByRole("button", { name: /有新记录/ })).toBeVisible();
    const offset = await scroll.evaluate((e, key) => {
      const row = [...e.querySelectorAll<HTMLElement>("li")].find((r) => r.dataset.historyKey === key)!;
      return row.getBoundingClientRect().top - e.getBoundingClientRect().top;
    }, reading.key);
    expect(Math.abs(offset - reading.offset)).toBeLessThan(2);
  } finally { await run.context.close(); }
});
