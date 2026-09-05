import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createBaseGame, resourceAmounts, type GameEventRecord, type GameState, type PlayerSeed } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, test, type BrowserContext, type Page, type WebSocketRoute } from "@playwright/test";

const roomId = "DEVFX1";
const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

test("development-card feedback reaches the actor and an affected mobile opponent", async ({ browser }) => {
  const { initial, resolved, record } = monopolyFixture();
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [];

  try {
    const owner = await openProjectedSeat(desktopContext, "player_1", roomView(initial, "player_1", []), errors);
    const victim = await openProjectedSeat(mobileContext, "player_2", roomView(initial, "player_2", []), errors);

    owner.socket.send(JSON.stringify({ type: "room_state", room: roomView(resolved, "player_1", [record]) }));
    victim.socket.send(JSON.stringify({ type: "room_state", room: roomView(resolved, "player_2", [record]) }));

    const ownerFeedback = owner.page.getByRole("status").filter({ hasText: "你使用了「垄断」" });
    const victimFeedback = victim.page.getByRole("status").filter({ hasText: "林使用了「垄断」" });
    await expect(ownerFeedback).toContainText("垄断矿 · 共获得 5 张");
    await expect(victimFeedback).toContainText("你交出 3 张");
    await expect(victim.page.getByRole("dialog", { name: "公开记录与房间信息" })).toHaveCount(0);

    const victimFeedbackBox = await victimFeedback.boundingBox();
    const victimDockBox = await victim.page.locator(".player-dock").boundingBox();
    if (victimFeedbackBox === null || victimDockBox === null) throw new Error("Missing development feedback layout bounds");
    expect(victimFeedbackBox.x).toBeGreaterThanOrEqual(0);
    expect(victimFeedbackBox.x + victimFeedbackBox.width).toBeLessThanOrEqual(390);
    expect(victimFeedbackBox.y + victimFeedbackBox.height).toBeLessThan(victimDockBox.y);
    await expect.poll(() => victim.page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });

    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    await owner.page.waitForTimeout(220);
    await Promise.all([
      owner.page.screenshot({ path: path.join(artifactDir, "development-monopoly-desktop.png"), fullPage: true }),
      victim.page.screenshot({ path: path.join(artifactDir, "development-monopoly-mobile.png"), fullPage: true }),
    ]);

    await expect(victim.page.locator('[data-resource-flight="player_1:ore"]')).toBeVisible({ timeout: 2_200 });
    await victim.page.waitForTimeout(180);
    await victim.page.screenshot({ path: path.join(artifactDir, "development-monopoly-resource-mobile.png"), fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await Promise.allSettled([desktopContext.close(), mobileContext.close()]);
  }
});

function monopolyFixture(): { readonly initial: GameState; readonly resolved: GameState; readonly record: GameEventRecord } {
  const base = createBaseGame({ id: "game_development_feedback_e2e", seed: 813, players });
  const initial: GameState = {
    ...base,
    revision: 10,
    phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 4 },
    players: base.players.map((player) => player.id === "player_1"
      ? {
          ...player,
          resources: resourceAmounts({ grain: 1 }),
          developmentCards: [{ id: "card_monopoly", type: "monopoly", acquiredTurn: 2 }],
        }
      : player.id === "player_2"
        ? { ...player, resources: resourceAmounts({ ore: 3 }) }
        : { ...player, resources: resourceAmounts({ ore: 2 }) }),
  };
  const resolved: GameState = {
    ...initial,
    revision: 11,
    developmentCardPlayedThisTurn: true,
    players: initial.players.map((player) => player.id === "player_1"
      ? { ...player, resources: resourceAmounts({ grain: 1, ore: 5 }), developmentCards: [] }
      : { ...player, resources: resourceAmounts({}) }),
  };
  return {
    initial,
    resolved,
    record: {
      revision: 11,
      event: {
        type: "development_card_played",
        playerId: "player_1",
        cardId: "card_monopoly",
        cardType: "monopoly",
        resource: "ore",
        total: 5,
        transfers: [
          { playerId: "player_2", amount: 3 },
          { playerId: "player_3", amount: 2 },
        ],
      },
    },
  };
}

async function openProjectedSeat(
  context: BrowserContext,
  playerId: string,
  initialRoom: RoomView,
  errors: string[],
): Promise<{ readonly page: Page; readonly socket: WebSocketRoute }> {
  await context.addInitScript((session) => {
    window.localStorage.setItem("catan-yltc-seat", JSON.stringify(session));
  }, { roomId, playerId, seatToken: `token_${playerId}` });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(new RegExp(`/api/rooms/${roomId}\\?`), async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(initialRoom) });
  });
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => {
    socket = route;
    route.send(JSON.stringify({ type: "room_state", room: initialRoom }));
  });
  await page.goto("/");
  await expect(page.getByRole("img", { name: "由十九块六边形地形组成的游戏棋盘" })).toBeVisible();
  await expect.poll(() => socket !== undefined).toBe(true);
  if (socket === undefined) throw new Error("Mock room socket was not opened");
  return { page, socket };
}

function roomView(state: GameState, viewerId: string, records: readonly GameEventRecord[]): RoomView {
  return {
    id: roomId,
    revision: state.revision,
    hostPlayerId: "player_1",
    members: players.map((player) => ({ ...player, isHost: player.id === "player_1" })),
    settings: {
      ruleProfile: "base-3-4",
      playerLimit: 4,
      victoryPointsToWin: 10,
      mapSeed: state.seed,
      bankCountsPublic: true,
    },
    previewMap: null,
    game: projectGameForPlayer(state, viewerId, records),
    setupAnalysis: null,
  };
}
