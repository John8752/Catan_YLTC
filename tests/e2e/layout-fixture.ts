import { createGame, resourceAmounts, type GameState, type PlayerSeed, type GameEventRecord } from "../../packages/game-core/src/index.js";
import { projectGameForPlayer, type RoomView } from "../../packages/protocol/src/index.js";
import { expect, type Browser, type BrowserContextOptions, type Page, type WebSocketRoute } from "@playwright/test";

const players: PlayerSeed[] = [
  { id: "p1", name: "布局验收", color: "terracotta" },
  { id: "p2", name: "玩家甲", color: "ocean" },
  { id: "p3", name: "玩家乙", color: "pine" },
  { id: "p4", name: "玩家丙", color: "wheat" },
  { id: "p5", name: "玩家丁", color: "plum" },
  { id: "p6", name: "玩家戊", color: "charcoal" },
];
export function fixture(count: 4 | 6, revision = 40, finished = false): RoomView {
  const base = createGame({ id: "layout_game", seed: 93357307, players: players.slice(0, count), ruleProfile: count === 6 ? "extended-5-6" : "base-3-4" });
  const state: GameState = {
    ...base, revision, phase: finished ? { kind: "finished", winnerId: "p1" } : { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 4 },
    lastRoll: [2, 3],
    players: base.players.map((player) => ({ ...player, resources: resourceAmounts({ brick: 2, lumber: 3, wool: 4, grain: 5, ore: 6 }) })),
  };
  const seatedPlayers = players.slice(0, count);
  const records: GameEventRecord[] = Array.from({ length: revision }, (_, i) => ({
    revision: i + 1,
    event: {
      type: "dice_rolled",
      playerId: seatedPlayers[i % seatedPlayers.length]!.id,
      dice: [(i % 6) + 1, ((i * 2 + 1) % 6) + 1] as readonly [number, number],
    },
  }));
  const projected = projectGameForPlayer(state, "p1", records);
  return {
    id: "LAYOUT", revision, hostPlayerId: "p1", previewMap: null,
    members: seatedPlayers.map((p) => ({ ...p, isHost: p.id === "p1" })),
    settings: { ruleProfile: count === 6 ? "extended-5-6" : "base-3-4", playerLimit: count === 6 ? 6 : 4, victoryPointsToWin: 10, mapSeed: state.seed, bankCountsPublic: true },
    game: { ...projected, effects: [] },
    setupAnalysis: null,
  };
}

export async function openFixture(browser: Browser, width: number, height: number, room: RoomView, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...options });
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

export async function measure(page: Page) {
  return page.evaluate(() => {
    const board = document.querySelector(".board-stage")!.getBoundingClientRect();
    const terrainFit = [...document.querySelectorAll(".hex-surface")].every((e) => {
      const b = e.getBoundingClientRect();
      return b.left >= board.left && b.right <= board.right && b.top >= board.top && b.bottom <= board.bottom;
    });
    const fit = [...document.querySelectorAll(".hex-surface,.port-sign")].every((e) => {
      const b = e.getBoundingClientRect();
      return b.left >= board.left && b.right <= board.right && b.top >= board.top && b.bottom <= board.bottom;
    });
    const font = (selector: string) => Number.parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
    const signs = [...document.querySelectorAll<SVGRectElement>(".port-sign > rect")].map((element) => element.getBoundingClientRect());
    const maxPortOverflow = Math.max(0, ...signs.flatMap((sign) => [
      board.left - sign.left,
      sign.right - board.right,
      board.top - sign.top,
      sign.bottom - board.bottom,
    ]));
    const intersect = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    // Only the rendered scale of the ratio label. Whether its box sits inside the
    // card is deliberately not measured: Chromium quantises SVG text metrics to
    // whole pixels while the card scales continuously, so the bottom edge drifts
    // a couple of tenths of a pixel either way depending on the viewport.
    const portText = [...document.querySelectorAll<SVGTextElement>(".port-ratio")].map((element) => {
      const matrix = element.getScreenCTM()!;
      return { font: Number.parseFloat(getComputedStyle(element).fontSize) * Math.hypot(matrix.a, matrix.b) };
    });
    const portContents = [...document.querySelectorAll(".port-sign")].map((sign) => {
      const card = sign.querySelector("rect")!.getBoundingClientRect();
      const icon = sign.querySelector(".port-type-icon")?.getBoundingClientRect();
      const ratio = sign.querySelector(".port-ratio")!.getBoundingClientRect();
      const generic = sign.parentElement!.getAttribute("data-port-resource") === "generic";
      const brickInk = sign.querySelector('[data-port-resource-icon="brick"] .resource-icon-primary');
      return { text: sign.textContent, generic,
        resource: sign.querySelector("[data-port-resource-icon]")?.getAttribute("data-port-resource-icon"),
        expectedResource: sign.parentElement!.getAttribute("data-port-resource"),
        bounds: { icon: icon?.toJSON(), card: card.toJSON(), ratio: ratio.toJSON() },
        contentGap: icon === undefined ? Number.NaN : ratio.top - icon.bottom,
        iconHasInk: brickInk === null || getComputedStyle(brickInk).fill !== getComputedStyle(sign.querySelector("rect")!).fill,
        iconFits: icon !== undefined && icon.left >= card.left && icon.right <= card.right && icon.top >= card.top && icon.bottom <= ratio.top,
      };
    });
    return {
      fit, terrainFit, maxPortOverflow, rootFont: font("html"), nameFont: font(".opponent-strip strong"),
      portText, portContents, portsSeparated: signs.every((a, i) => signs.slice(i + 1).every((b) => !intersect(a, b))),
      portTileRatio: signs[0]!.width / document.querySelector(".hex-surface")!.getBoundingClientRect().width,
      portNumberOverlaps: [...document.querySelectorAll(".token")].flatMap((e) => signs.flatMap((sign, index) => intersect(sign, e.getBoundingClientRect()) ? [{ hex: e.closest('[data-hex-id]')?.getAttribute('data-hex-id'), portIndex: index }] : [])),
      statFont: font('[data-opponent-summary] [title="资源卡"]'),
      tile: rect(".hex-surface"), number: rect(".token-number"), dock: rect(".player-dock"),
      board: board.toJSON(), opponents: rect(".opponent-strip"),
      forecast: document.querySelector('[data-turn-forecast]')?.getBoundingClientRect().toJSON(),
      heading: document.querySelector('.board-heading')?.getBoundingClientRect().toJSON(),
      headingChildren: [...document.querySelector('.board-heading')?.children ?? []].map((element) => ({
        text: element.textContent, bounds: element.getBoundingClientRect().toJSON(), display: getComputedStyle(element).display,
      })),
      mapScale: new DOMMatrix(getComputedStyle(document.querySelector(".board-transform")!).transform).a,
      overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
      sidebar: document.querySelector("[data-game-sidebar]")?.getBoundingClientRect().toJSON(),
    };
  });
}
