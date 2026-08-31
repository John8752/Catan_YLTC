import { mkdir } from "node:fs/promises";
import { createGame, resourceAmounts, type GameState } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, test, type Browser, type WebSocketRoute } from "@playwright/test";

const base = createGame({ id: "attention_e2e", seed: 42, ruleProfile: "extended-5-6", players: [
  { id: "p1", name: "自己", color: "terracotta" }, { id: "p2", name: "对手", color: "ocean" },
  { id: "p3", name: "丙", color: "pine" }, { id: "p4", name: "丁", color: "wheat" },
  { id: "p5", name: "戊", color: "plum" }, { id: "p6", name: "己", color: "charcoal" },
] });
const numbered = base.map.hexes.find((hex) => hex.numberToken !== null)!;
function scenario(revision: number, phase: GameState["phase"], extra: Partial<GameState> = {}): RoomView {
  const state = { ...base, revision, phase, map: { ...base.map, robberHexId: numbered.id }, ...extra };
  return {
    id: "NOTICE", revision, hostPlayerId: "p1", previewMap: null,
    members: base.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isHost: p.id === "p1" })),
    settings: { ruleProfile: "extended-5-6", playerLimit: 6, victoryPointsToWin: 10, mapSeed: base.seed, bankCountsPublic: false },
    game: projectGameForPlayer(state, "p1", [], null, { bankCountsPublic: false }),
  };
}
const turn = (step: Extract<GameState["phase"], { kind: "turn" }>["step"], activePlayerId = "p1", turnNumber = 1): GameState["phase"] => ({
  kind: "turn", step, activePlayerId, turnNumber, primaryPlayerId: step === "paired-action" ? "p2" : activePlayerId,
});
async function openScenario(browser: Browser, width: number, height: number, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  let room = scenario(1, turn("action", "p2"));
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "NOTICE", playerId: "p1", seatToken: "fixture" })));
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/\/api\/rooms\/NOTICE\?/, (route) => route.fulfill({ json: room }));
  let socket: WebSocketRoute | undefined;
  await page.routeWebSocket(/\/ws\?/, (route) => { socket = route; route.send(JSON.stringify({ type: "room_state", room })); });
  await page.goto("/");
  await expect(page.locator(".hex-tile")).toHaveCount(30);
  await expect.poll(() => socket !== undefined).toBe(true);
  return { context, page, errors, push: (next: RoomView) => { room = next; socket!.send(JSON.stringify({ type: "room_state", room })); } };
}

for (const [width, height] of [[360, 640], [390, 844], [960, 540], [1920, 1021]] as const) {
  test(`robber remains clear of number tokens at ${width}x${height}`, async ({ browser }) => {
    const run = await openScenario(browser, width, height);
    const { page } = run;
    try {
      const robberBounds = await page.evaluate((hexId) => {
        const pawn = document.querySelector('[data-robber-piece]')!.getBoundingClientRect();
        const tile = document.querySelector(`[data-hex-id="${hexId}"] .hex-surface`)!.getBoundingClientRect();
        const token = document.querySelector(`[data-hex-id="${hexId}"] .token`)!.getBoundingClientRect();
        const anchor = document.querySelector(`[data-robber-anchor="${hexId}"]`)!.getBoundingClientRect();
        return { clear: pawn.bottom < token.top, upperLeft: pawn.x + pawn.width / 2 < tile.x + tile.width / 2 && pawn.y + pawn.height / 2 < tile.y + tile.height / 2,
          inside: pawn.left >= tile.left && pawn.right <= tile.right && pawn.top >= tile.top && pawn.bottom <= tile.bottom,
          anchorDistance: Math.hypot(pawn.x + pawn.width / 2 - anchor.x - anchor.width / 2, pawn.y + pawn.height / 2 - anchor.y - anchor.height / 2) };
      }, numbered.id);
      expect(robberBounds.clear).toBe(true);
      expect(robberBounds.upperLeft).toBe(true);
      expect(robberBounds.inside).toBe(true);
      expect(robberBounds.anchorDistance).toBeLessThan(0.5);
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}
