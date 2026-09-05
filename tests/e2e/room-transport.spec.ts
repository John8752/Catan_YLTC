import { expect, test, type WebSocketRoute } from "@playwright/test";
import { createRoomStreamEncoder, ROOM_EVENT_TRANSPORT, type RoomView } from "../../packages/protocol/src/index.js";
import { fixture } from "./layout-fixture.js";
import { iPhone16BrowserAreaCases } from "./viewport-cases.js";

for (const viewport of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...iPhone16BrowserAreaCases]) {
  test(`cached map, ack recovery and reconnect preserve the game at ${viewport.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(viewport.options);
    await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let current = fixture(6), reads = 0, commands = 0, socket!: WebSocketRoute, encode = createRoomStreamEncoder(), connections = 0;
    let sendUpdate: (() => void) | undefined;
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: null }));
    await page.route(/\/api\/rooms\/LAYOUT\?/, (route) => { reads++; return route.fulfill({ json: current }); });
    await page.routeWebSocket(/\/ws\?/, (route) => {
      expect(new URL(route.url()).searchParams.get("transport")).toBe(ROOM_EVENT_TRANSPORT);
      socket = route; connections++; encode = createRoomStreamEncoder();
      const first = encode(current);
      expect(first.room.game?.map.geometry).not.toBeNull();
      route.send(JSON.stringify(first));
    });
    await page.route("**/api/rooms/LAYOUT/commands", async (route) => {
      commands++;
      const body = route.request().postDataJSON();
      expect(body.responseMode).toBe("ack");
      expect(body.command.type).toBe("BuyDevelopmentCard");
      const game = current.game!;
      current = { ...current, revision: current.revision + 1, game: { ...game, revision: game.revision + 1,
        developmentDeckCount: game.developmentDeckCount - 1,
        you: { ...game.you, developmentCards: [...game.you.developmentCards, { id: `new-${commands}`, type: "knight", acquiredTurn: 4 }] },
      } };
      sendUpdate = () => { const update = encode(current); expect(update.room.game?.map.geometry).toBeNull(); socket.send(JSON.stringify(update)); };
      await route.fulfill({ json: { commandId: body.commandId, roomId: current.id, roomRevision: current.revision, gameRevision: current.game!.revision } });
    });
    try {
      await page.goto("/");
      await expect(page.locator(".hex-tile")).toHaveCount(30);
      expect(reads).toBe(0);
      if (viewport.name !== "desktop") await page.getByRole("button", { name: "展开本回合操作" }).click();
      await page.locator(".development-drawer > summary").click();
      const buy = page.getByRole("button", { name: /购买发展卡/ });
      await buy.click();
      await expect.poll(() => commands).toBe(1);
      await expect(buy).toBeDisabled();
      sendUpdate!();
      await expect(page.locator(".development-drawer > summary")).toHaveText("发展卡（1）");
      await expect(buy).toBeEnabled();
      expect(reads).toBe(0);

      // Missing push: accept the ACK, then recover using a single full HTTP snapshot.
      await buy.click();
      await expect.poll(() => commands).toBe(2);
      await expect(page.locator(".development-drawer > summary")).toHaveText("发展卡（2）");
      await expect(buy).toBeEnabled();
      expect(reads).toBe(1);
      const older = fixture(6); socket.send(JSON.stringify({ type: "room_state", room: older }));
      await expect(page.locator(".development-drawer > summary")).toHaveText("发展卡（2）");

      // A cache-free reconnect carries geometry again and preserves hand/map state.
      socket.close();
      await expect.poll(() => connections).toBe(2);
      await expect(page.locator(".development-drawer > summary")).toHaveText("发展卡（2）");
      expect(reads).toBe(1);
      const nextHex = current.game!.map.hexes.find((h) => h.id !== current.game!.map.robberHexId)!;
      current = { ...current, revision: current.revision + 1, game: { ...current.game!, revision: current.game!.revision + 1,
        map: { ...current.game!.map, robberHexId: nextHex.id } } };
      const moved = encode(current); expect(moved.room.game?.map.geometry).toBeNull();
      socket.send(JSON.stringify(moved));
      await expect(page.locator(".hex-tile")).toHaveCount(30);
      // Inspect the same SVG robber anchor used by gameplay, not a second map renderer.
      await expect(page.locator("[data-robber-hex-id]")).toHaveAttribute("data-robber-hex-id", nextHex.id);
      await page.screenshot({ path: testInfo.outputPath("transport-game.png"), animations: "disabled", scale: "css" });
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  });
}

test("missing map baseline reconnects instead of rendering an incomplete board", async ({ page }) => {
  const room: RoomView = fixture(4);
  await page.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
  let connections = 0;
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: null }));
  await page.routeWebSocket(/\/ws\?/, (route) => {
    const encode = createRoomStreamEncoder(); connections++;
    if (connections === 1) encode(room); // Deliberately omit the initial geometry.
    route.send(JSON.stringify(encode(room)));
  });
  await page.goto("/");
  await expect.poll(() => connections).toBe(2);
  await expect(page.locator(".hex-tile")).toHaveCount(19);
});
