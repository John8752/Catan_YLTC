import { createGame, resourceAmounts, type GameState } from "@catan/game-core";
import { expect, it } from "vitest";
import { describeAction } from "./action-attention.js";
import { projectGameForPlayer } from "./views.js";

const base = createGame({ id: "attention", seed: 42, ruleProfile: "extended-5-6", players: [
  { id: "p1", name: "甲", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" },
  { id: "p3", name: "丙", color: "pine" }, { id: "p4", name: "丁", color: "wheat" },
  { id: "p5", name: "戊", color: "plum" },
] });
const turn = (step: Extract<GameState["phase"], { kind: "turn" }>["step"], activePlayerId = "p1"): GameState => ({
  ...base, phase: { kind: "turn", activePlayerId, primaryPlayerId: "p1", turnNumber: 3, step },
});
const attention = (state: GameState, viewer = "p1") => projectGameForPlayer(state, viewer).effects.find((effect) => effect.kind === "action-attention");

it("notifies one opportunity across roll, actions and repeated snapshots", () => {
  const roll = attention(turn("roll"));
  expect(roll?.title).toBe("轮到你了 · 请掷骰子");
  expect(attention(turn("action"))?.id).toBe(roll?.id);
  expect(attention({ ...turn("action"), revision: 15 })?.id).toBe(roll?.id);
  expect(attention(turn("action"), "p2")).toBeUndefined();
  expect(attention(turn("paired-action", "p4"), "p4")?.notice).toContain("搭档行动");
});

it("keeps settlement and road together but distinguishes consecutive setup placements", () => {
  if (base.phase.kind !== "setup") throw new Error("Expected setup");
  expect(attention(base)?.title).toContain("定居点");
  const road = { ...base, phase: { ...base.phase, step: "road" as const, settlementVertexId: "v1" } };
  expect(attention(road)?.id).toBe(attention(base)?.id);
  expect(attention(road)?.title).toContain("道路");
  const otherPlacement = { ...base, phase: { ...base.phase, placementIndex: 9 } };
  expect(attention(otherPlacement)?.id).not.toBe(attention(base)?.id);
});

it("highlights mandatory discard for an inactive seat and stops after their response", () => {
  const state = { ...turn("discard"), pendingDiscards: [{ playerId: "p2", count: 4 }] };
  expect(attention(state, "p2")).toMatchObject({ tone: "required", notice: "请弃掉 4 张资源" });
  expect(attention(state)).toBeUndefined();
  expect(attention({ ...state, pendingDiscards: [] }, "p2")).toBeUndefined();
  expect(attention(turn("robber"))?.notice).toBe("请移动强盗");
  expect(attention(turn("free-road"))?.notice).toBe("请放置免费道路");
});

it("uses mild trade copy and never calls an incoming offer your turn", () => {
  const state: GameState = { ...turn("action"), openTrade: {
    offerId: "offer1", proposerId: "p1", give: resourceAmounts({ brick: 1 }), receive: resourceAmounts({ wool: 1 }), responses: [],
  } };
  expect(attention(state, "p2")).toMatchObject({ tone: "trade", notice: "收到一份交易报价" });
  expect(attention(state, "p2")?.title).not.toContain("轮到你");
  expect(attention({ ...state, phase: { kind: "finished", winnerId: "p1" } })).toBeUndefined();
  expect(describeAction(projectGameForPlayer(turn("action"), "p2").interaction)).toBeNull();
});
