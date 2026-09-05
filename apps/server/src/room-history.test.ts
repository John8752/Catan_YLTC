import type { RoomView, GameHistoryPage } from "@catan/protocol";
import { expect, it } from "vitest";
import { RoomRegistry } from "./rooms.js";
import { buildApp } from "./app.js";
import type { RoomRecord } from "./room-types.js";

it("sends new history/effects per subscription and recent history without replay effects on reconnect", () => {
  const registry = new RoomRegistry({ nextSeed: () => 42 });
  try {
    const host = registry.createRoom("甲"); registry.joinRoom(host.roomId, "乙");
    const modern: RoomView[] = [], legacy: RoomView[] = [];
    registry.subscribe(host.roomId, host.seatToken, (view) => modern.push(view), undefined, undefined, true);
    registry.subscribe(host.roomId, host.seatToken, (view) => legacy.push(view));
    registry.startRoom(host.roomId, host.seatToken);
    for (const [index, type] of ["PlaceInitialSettlement", "PlaceInitialRoad"].entries()) {
      const game = modern.at(-1)!.game!;
      registry.executeCommand(host.roomId, host.seatToken, String(index), game.revision, type === "PlaceInitialSettlement"
        ? { type, vertexId: game.interaction.vertexIds[0]! } : { type: "PlaceInitialRoad", edgeId: game.interaction.edgeIds[0]! });
    }
    expect(modern.at(-1)!.game!.history).toHaveLength(1);
    expect(legacy.at(-1)!.game!.history).toHaveLength(2);
    expect(modern.at(-1)!.game!.historyRange).toEqual({ afterRevision: 2, throughRevision: 3 });
    const reconnected: RoomView[] = [];
    registry.subscribe(host.roomId, host.seatToken, (view) => reconnected.push(view), undefined, undefined, true);
    expect(reconnected[0]!.game!.history).toHaveLength(2);
    expect(reconnected[0]!.game!.effects.filter((effect) => effect.kind !== "action-attention")).toEqual([]);
  } finally { registry.dispose(); }
});

it("pages past 200 events through an authenticated seat and rejects invalid or replaced credentials", async () => {
  const registry = new RoomRegistry({ nextSeed: () => 42 }), app = await buildApp(registry);
  registry.configureAccountValidation(() => true); // This fixture exercises seat rotation; auth/session validity has its own suite.
  try {
    const host = registry.createRoom("甲", "owner"), other = registry.joinRoom(host.roomId, "乙");
    registry.startRoom(host.roomId, host.seatToken);
    const internal = (registry as unknown as { rooms: Map<string, RoomRecord> }).rooms.get(host.roomId)!;
    internal.game = { ...internal.game!, revision: 601 };
    internal.history.push(...Array.from({ length: 600 }, (_, i) => ({ revision: i + 2,
      event: { type: "development_card_bought", playerId: host.playerId, cardId: `secret-${i}`, cardType: "victory-point" } as const })));
    const url = `/api/rooms/${host.roomId}/history?gameId=${internal.game.id}`;
    let before: number | undefined;
    let count = 0; const ids = new Set<string>();
    do {
      const response = await app.inject(`${url}&seatToken=${other.seatToken}${before ? `&beforeRevision=${before}` : ""}`);
      expect(response.statusCode, response.body).toBe(200);
      const page = response.json<GameHistoryPage>();
      expect(page.entries.every((entry) => entry.privateDetail === null)).toBe(true);
      expect(JSON.stringify(page)).not.toContain("victory-point");
      for (const entry of page.entries) { expect(ids.has(entry.id)).toBe(false); ids.add(entry.id); }
      count += page.entries.length;
      before = page.range.afterRevision === 0 ? undefined : page.range.afterRevision + 1;
    } while (before);
    expect(count).toBe(600);
    expect((await app.inject(`${url}&seatToken=${host.seatToken}`)).json<GameHistoryPage>().entries[0]!.privateDetail).toContain("胜利点");
    const recoveryUrl = `/api/rooms/${host.roomId}?transport=events-v2&seatToken=${host.seatToken}`;
    const snapshot = (await app.inject(recoveryUrl)).json<RoomView>();
    expect(snapshot.game!.effects.filter((effect) => effect.kind !== "action-attention")).toEqual([]);
    const recovered = (await app.inject(`${recoveryUrl}&afterRevision=600`)).json<RoomView>();
    expect(recovered.game!.history).toHaveLength(1);
    expect(recovered.game!.effects.some((effect) => effect.kind === "resource-spend")).toBe(true);
    expect(recovered.game!.effects.every((effect) => effect.kind === "action-attention" || effect.revision === 601)).toBe(true);
    expect((await app.inject(`${recoveryUrl}&afterRevision=602`)).statusCode).toBe(400);
    for (const cursor of ["0", "-1", "9999999", "abc", "2.5"]) expect((await app.inject(`${url}&seatToken=${other.seatToken}&beforeRevision=${cursor}`)).statusCode).toBe(400);
    expect((await app.inject(`${url}&seatToken=wrong`)).statusCode).toBe(400);
    registry.prepareAccountTakeover("owner")();
    expect((await app.inject(`${url}&seatToken=${host.seatToken}`)).statusCode).toBe(400);
    expect((await app.inject(`/api/rooms/${host.roomId}/history?gameId=wrong&seatToken=${other.seatToken}`)).statusCode).toBe(400);
  } finally { await app.close(); }
});
