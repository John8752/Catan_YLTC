import { expect, it } from "vitest";
import { createPoker, actPoker, freshDeck, DEFAULT_POKER_SETTINGS } from "@catan/game-core/texas-holdem";
import { projectPoker } from "@catan/protocol/texas-holdem";
import { PokerMotionCursor } from "./motion-cursor.js";
import { pokerSeatPositions } from "./seat-layout.js";
it("animates new live transitions once and skips initial, replayed and reconnect snapshots", () => {
  const s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
  const v = projectPoker(s, "a"), next = projectPoker(actPoker(s, "a", { type: "call" }), "a"), cursor = new PokerMotionCursor();
  expect(cursor.consume(v, 1).effects).toEqual([]);
  expect(cursor.consume(next, 1).effects).toEqual(next.effects);
  expect(cursor.consume(next, 1).effects).toEqual([]);
  expect(cursor.consume({ ...next, revision: 8 }, 2)).toEqual({ effects: [], reset: true });
  expect(cursor.consume({ ...next, revision: 9 }, 2).effects).toEqual(next.effects);
});
it("animates a new deal after a lobby transition, but never an old match on reconnect", () => {
  const s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck()), v = projectPoker(s, "a"), cursor = new PokerMotionCursor();
  cursor.consume(null, 1); expect(cursor.consume(v, 1).effects.some((e) => e.kind === "deal")).toBe(true);
  expect(cursor.consume({ ...v, id: "another" }, 2).effects).toEqual([]);
  cursor.consume(null, 2); expect(cursor.consume({ ...v, id: "third" }, 2).effects).toHaveLength(v.effects.length);
});
it("rotates the view without changing seat order and reserves room for the bottom hand", () => {
  const ids = Array.from({ length: 9 }, (_, i) => `${i}`), points = pokerSeatPositions(ids, "3", 460);
  expect(points.get("3")!.x).toBe(50); expect(points.get("3")!.y * 4.6 + 142).toBeCloseTo(460);
  expect(points.get("4")).toEqual({ x: 10, y: 65 }); expect(points.get("2")).toEqual({ x: 90, y: 65 });
  expect(new Set([...points.values()].map((p) => `${p.x}:${p.y}`)).size).toBe(9);
});
