import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PlayerSessionResponse, RoomView } from "@catan/protocol";
import { expect, test } from "@playwright/test";

test("six-player board keeps five opponents, the map and the private dock in one phone viewport", async ({ browser, request }) => {
  const hostResponse = await request.post("/api/rooms", { data: { playerName: "甲" } });
  const host = await hostResponse.json() as PlayerSessionResponse;
  const settingsResponse = await request.patch(`/api/rooms/${host.roomId}/settings`, {
    data: {
      seatToken: host.seatToken,
      expectedRevision: host.room.revision,
      ruleProfile: "extended-5-6",
      playerLimit: 6,
      victoryPointsToWin: 10,
    },
  });
  expect(settingsResponse.ok()).toBe(true);

  for (const playerName of ["乙", "丙", "丁", "戊", "己"]) {
    const response = await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName } });
    expect(response.ok()).toBe(true);
  }

  const startResponse = await request.post(`/api/rooms/${host.roomId}/start`, { data: { seatToken: host.seatToken } });
  const started = await startResponse.json() as RoomView;
  expect(started.game?.map.hexes).toHaveLength(30);

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((seat) => {
    window.localStorage.setItem("catan-yltc-seat", JSON.stringify(seat));
  }, { roomId: host.roomId, playerId: host.playerId, seatToken: host.seatToken });
  const page = await context.newPage();

  try {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "由三十块六边形地形组成的游戏棋盘" })).toBeVisible();
    const opponentStrip = page.getByRole("region", { name: "其他玩家" });
    await expect(opponentStrip.locator("[data-player-id]")).toHaveCount(5);
    await expect.poll(() => opponentStrip.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect.poll(() => page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });
    const dock = page.locator(".player-dock");
    await expect(dock).toBeVisible();
    await expect.poll(async () => {
      const box = await dock.boundingBox();
      return box !== null && box.y + box.height <= 845 && box.y + box.height >= 810;
    }).toBe(true);

    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    await page.screenshot({ path: path.join(artifactDir, "extended-six-player-mobile.png"), fullPage: true });

    await page.setViewportSize({ width: 360, height: 640 });
    await expect.poll(() => page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });
    await expect(page.getByRole("button", { name: "放大地图" })).toBeVisible();
    await expect(page.locator(".player-dock")).toBeVisible();
    await page.screenshot({ path: path.join(artifactDir, "extended-six-player-small-phone.png"), fullPage: true });
  } finally {
    await context.close();
  }
});
