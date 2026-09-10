import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import type { RoomSession } from "@catan/protocol/platform";
import { projectGameForPlayer, type RoomView } from "../../../packages/protocol/src/catan/index.js";
import { createGame, executeGameCommand, legalInitialRoadEdges, legalInitialSettlementVertices } from "../../../packages/game-core/src/catan.js";
import { fixture, measure, openFixture } from "./fixtures.js";
import { iPhone16BrowserAreaCases, primaryPhoneCases, viewportCase } from "../viewport-cases.js";

for (const { name, width, height, options } of [viewportCase(1366, 768), ...iPhone16BrowserAreaCases]) {
  test(`large map selection syncs six seats, rerolls, starts and reconnects at ${name}`, async ({ browser, request }) => {
    const created = await request.post("/api/rooms", { data: { gameId: "catan", playerName: "房主" } });
    const host = await created.json() as RoomSession<RoomView>;
    const joined = await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: "同桌" } });
    const guest = await joined.json() as RoomSession<RoomView>;
    const contexts = [];
    const errors: string[] = [];
    try {
      const pages = [];
      for (const seat of [host, guest]) {
        const context = await browser.newContext({ viewport: { width, height }, ...options });
        contexts.push(context);
        await context.addInitScript((seat) => localStorage.setItem("catan-yltc-seat", JSON.stringify(seat)),
          { roomId: seat.roomId, playerId: seat.playerId, seatToken: seat.seatToken });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("/");
        await expect(page.locator(".hex-tile")).toHaveCount(19);
        pages.push(page);
      }
      const [owner, peer] = pages;
      await owner!.getByRole("button", { name: "最多 6 人", exact: true }).click();
      await expect(peer!.locator(".hex-tile")).toHaveCount(30);
      await owner!.getByRole("combobox", { name: "获胜分数" }).selectOption("12");
      for (const [profile, count] of [["large-5-6", 37], ["extended-5-6", 30], ["large-5-6", 37]] as const) {
        await owner!.getByRole("combobox", { name: "地图大小" }).selectOption(profile);
        for (const page of pages) {
          await expect(page.locator(".hex-tile")).toHaveCount(count);
          await expect(page.getByRole("combobox", { name: "地图大小" })).toHaveValue(profile);
          await expect(page.getByRole("combobox", { name: "获胜分数" })).toHaveValue("12");
        }
      }
      await expect(peer!.getByRole("combobox", { name: "地图大小" })).toBeDisabled();
      const readRoom = async () => (await request.get(`/api/rooms/${host.roomId}`, { params: { seatToken: host.seatToken } })).json() as Promise<RoomView>;
      const before = await readRoom();
      const forbidden = await request.patch(`/api/rooms/${host.roomId}/settings`, { data: {
        seatToken: guest.seatToken, expectedRevision: before.revision, ruleProfile: "extended-5-6", victoryPointsToWin: 12,
      } });
      expect(forbidden.ok()).toBe(false);
      await owner!.getByRole("button", { name: "再次随机", exact: true }).click();
      await expect.poll(async () => (await readRoom()).settings.mapSeed).not.toBe(before.settings.mapSeed);
      const rerolled = await readRoom();
      expect(rerolled.previewMap?.hexes).toHaveLength(37);
      await expect(peer!.getByText(`地图 #${rerolled.settings.mapSeed}`, { exact: false })).toBeVisible();
      for (const playerName of ["三", "四", "五", "六"]) {
        expect((await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName } })).ok()).toBe(true);
      }
      await owner!.getByRole("button", { name: "使用当前地图开局", exact: true }).click();
      await expect(owner!.getByRole("img", { name: "由37块六边形地形组成的游戏棋盘" })).toBeVisible();
      const started = await readRoom();
      expect(started.game?.map).toEqual(rerolled.previewMap);
      expect(started.game?.ruleProfile).toBe("large-5-6");
      expect(started.game?.victoryPointsToWin).toBe(12);
      const targets = owner!.getByRole("button", { name: "在这里放置定居点", exact: true });
      await expect(targets.first()).toBeVisible();
      await targets.nth(Math.floor(await targets.count() / 2)).click();
      await owner!.getByRole("button", { name: "确认放置", exact: true }).click();
      await expect.poll(async () => (await readRoom()).game?.buildings.length).toBe(1);
      await peer!.reload();
      await expect(peer!.getByRole("img", { name: "由37块六边形地形组成的游戏棋盘" })).toBeVisible();
      await expect(peer!.locator(".hex-tile")).toHaveCount(37);
      await expect(peer!.locator("[data-port-id]")).toHaveCount(12);
      expect(errors).toEqual([]);
    } finally { for (const context of contexts) await context.close(); }
  });
}

function largeRoom(): RoomView {
  const template = fixture(6);
  let state = createGame({ id: "large-layout", seed: 42, ruleProfile: "large-5-6", players: template.members });
  while (state.phase.kind === "setup") {
    const actor = state.phase.placementOrder[state.phase.placementIndex]!;
    const command = state.phase.step === "settlement"
      ? { type: "PlaceInitialSettlement" as const, vertexId: legalInitialSettlementVertices(state, actor)[0]! }
      : { type: "PlaceInitialRoad" as const, edgeId: legalInitialRoadEdges(state, actor)[0]! };
    const result = executeGameCommand(state, actor, command);
    if (!result.accepted) throw new Error(result.error.message);
    state = result.state;
  }
  state = { ...state, phase: { kind: "turn", activePlayerId: "p1", step: "action", turnNumber: 1 } };
  return { ...template, matchId: state.id, revision: state.revision,
    settings: { ...template.settings, ruleProfile: "large-5-6", mapSeed: state.seed },
    game: projectGameForPlayer(state, "p1"),
  };
}

for (const { name, width, height, options } of [...primaryPhoneCases, viewportCase(1366, 768)]) {
  test(`large map keeps ports, dock, zoom and panning usable at ${name}`, async ({ browser }) => {
    const run = await openFixture(browser, width, height, largeRoom(), options);
    try {
      const initial = await measure(run.page);
      expect(initial.overflow).toBe(false);
      expect(initial.terrainFit).toBe(true);
      expect(initial.maxPortOverflow).toBeLessThanOrEqual(initial.tile.width * 0.2);
      expect(initial.portNumberOverlaps).toEqual([]);
      expect(initial.portsSeparated).toBe(true);
      expect(initial.portContents).toHaveLength(12);
      expect(initial.portContents.every((port) => port.iconFits)).toBe(true);
      expect(initial.dock.bottom).toBeLessThanOrEqual(height + 1);
      await expect(run.page.getByRole("button", { name: "结束回合", exact: true })).toBeInViewport();
      const viewport = run.page.getByRole("region", { name: "可移动地图视口", exact: true });
      await viewport.focus();
      await run.page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await measure(run.page)).tile.x).toBeGreaterThan(initial.tile.x + 20);
      await run.page.keyboard.press("Home");
      if (options.isMobile) {
        const box = (await viewport.boundingBox())!;
        const session = await run.context.newCDPSession(run.page);
        try {
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          const radius = Math.min(box.width, box.height) * 0.1;
          const points = (r: number) => [
            { id: 1, x: x - r, y, radiusX: 4, radiusY: 4, force: 1 },
            { id: 2, x: x + r, y, radiusX: 4, radiusY: 4, force: 1 },
          ];
          await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(radius) });
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(radius * 1.8) });
          await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } finally { await session.detach(); }
      } else {
        await run.page.getByRole("button", { name: "放大地图", exact: true }).click();
      }
      await expect.poll(async () => (await measure(run.page)).tile.width).toBeGreaterThan(initial.tile.width * 1.1);
      const zoomed = await measure(run.page);
      expect(zoomed.portTileRatio).toBeCloseTo(initial.portTileRatio, 4);
      expect(zoomed.portText[0]!.font / zoomed.tile.width).toBeCloseTo(initial.portText[0]!.font / initial.tile.width, 4);
      await viewport.focus();
      await run.page.keyboard.press("Home");
      await expect.poll(async () => (await measure(run.page)).tile.width).toBeCloseTo(initial.tile.width, 1);
      await mkdir("output/playwright", { recursive: true });
      await run.page.screenshot({ path: `output/playwright/large-6-${width}x${height}.png`, fullPage: true, scale: "css" });
      expect(run.errors).toEqual([]);
    } finally { await run.context.close(); }
  });
}
