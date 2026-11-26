import { expect, test, type WebSocketRoute } from "@playwright/test";
import { createCarcassonne, executeCarcassonne } from "../../../packages/game-core/src/carcassonne/index.js";
import { createPlatformRoomEncoder, PLATFORM_ROOM_TRANSPORT } from "../../../packages/protocol/src/platform-stream.js";
import { PLAYER_COLORS } from "../../../packages/game-core/src/primitives/index.js";
import { iPhone16BrowserAreaCases } from "../viewport-cases.js";
import { roomFor, chooseCandidate } from "./fixtures.js";

for (const device of [{ name: "desktop", options: { viewport: { width: 1440, height: 900 } } }, ...iPhone16BrowserAreaCases]) test(`ACK loss recovery and delta gaps reconnect atomically · ${device.name}`, async ({ browser }) => {
  const context = await browser.newContext({ ...device.options, reducedMotion: "reduce" });
  await context.addInitScript(() => localStorage.setItem("catan-yltc-seat", JSON.stringify({ roomId: "LAYOUT", playerId: "p1", seatToken: "test" })));
  const page = await context.newPage(), errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let state = createCarcassonne("layout-match", Array.from({ length: 5 }, (_, i) => ({ id: `p${i + 1}`, name: `朋友${i + 1}`, color: PLAYER_COLORS[i]! })), 42);
  let room = roomFor(state), reads = 0, commands = 0, connections = 0, socket!: WebSocketRoute, encode = createPlatformRoomEncoder(PLATFORM_ROOM_TRANSPORT);
  await page.route("**/api/auth/me", route => route.fulfill({ json: null }));
  await page.route(/\/api\/rooms\/LAYOUT\?/, route => { reads++; return route.fulfill({ json: room }); });
  await page.routeWebSocket(/\/ws\?/, route => {
    connections++; socket = route; encode = createPlatformRoomEncoder(PLATFORM_ROOM_TRANSPORT);
    route.send(JSON.stringify(encode(room)));
  });
  await page.route("**/api/rooms/LAYOUT/carcassonne/commands", async route => {
    commands++; const body = route.request().postDataJSON();
    state = executeCarcassonne(state, "p1", body.command); room = roomFor(state);
    encode(room); // The accepted push is lost, but the server has advanced its cursor.
    await route.fulfill({ json: { type: "command_ack", commandId: body.commandId, roomId: room.id, gameId: room.gameId, matchId: room.matchId, roomRevision: room.revision, gameRevision: state.revision } });
  });
  try {
    await page.goto("/"); const arena = page.locator('[data-carc-renderer="ready"]');
    await expect(arena).toHaveAttribute("data-tile-count", "1"); expect(reads).toBe(0);
    const counters = page.locator("[data-carc-candidate-builds]");
    const count = await counters.getAttribute("data-carc-candidate-builds");
    await page.getByRole("button", { name: "旋转地图视角", exact: true }).click();
    await expect(arena).toHaveAttribute("data-camera-settled", "true");
    expect(await counters.getAttribute("data-carc-candidate-builds")).toBe(count);
    await chooseCandidate(page); await page.getByRole("button", { name: "放在这里", exact: true }).click();
    await page.getByRole("button", { name: "不放随从", exact: true }).click();
    await page.getByRole("button", { name: "完成回合", exact: true }).click();
    await expect(arena).toHaveAttribute("data-tile-count", "2"); expect(commands).toBe(1); expect(reads).toBe(1);
    const own = room.game!; if (own.phase.kind !== "turn") throw Error();
    const { projectCarcassonne } = await import("../../../packages/protocol/src/carcassonne/index.js");
    const p = projectCarcassonne(state, own.phase.playerId).placements[0]!;
    state = executeCarcassonne(state, own.phase.playerId, { type: "place", matchId: state.id, turn: own.phase.turn, x: p.x, y: p.y, rotation: p.rotation, meeple: null }); room = roomFor(state);
    socket.send(JSON.stringify(encode(room))); // Decoder missed the previous WS base, so reconnect.
    await expect.poll(() => connections).toBe(2);
    await expect(arena).toHaveAttribute("data-tile-count", "3");
    expect(commands).toBe(1); expect(reads).toBe(1); expect(errors).toEqual([]);
  } finally { await context.close(); }
});
