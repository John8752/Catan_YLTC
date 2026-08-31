import { createBaseGame, type GameEventRecord, type GameState } from "@catan/game-core";
import { describe, expect, it } from "vitest";
import { collectVictoryWarnings, victoryWarningTier, type VictoryWarningEffectView } from "./victory-warning.js";
import { projectGameForPlayer } from "./views.js";

const base = createBaseGame({ id: "victory-warning", seed: 42, players: [
  { id: "p1", name: "林", color: "terracotta" }, { id: "p2", name: "周", color: "ocean" }, { id: "p3", name: "陈", color: "pine" },
] });
function state(score: number, revision = score, target = 10): GameState {
  return { ...base, revision, victoryPointsToWin: target,
    phase: { kind: "turn", step: "action", activePlayerId: "p1", turnNumber: 1 },
    players: base.players.map((player) => ({ ...player, visibleVictoryPoints: player.id === "p1" ? score : 0 })),
  };
}
const view = (game: GameState, warnings: readonly VictoryWarningEffectView[], viewer = "p1", records: readonly GameEventRecord[] = []) =>
  projectGameForPlayer(game, viewer, records, null, { bankCountsPublic: true }, warnings);

describe("public near-victory milestones", () => {
  it.each([5, 10, 12, 15])("starts three points below target %i and escalates at two and one", (target) => {
    const recorded: VictoryWarningEffectView[] = [];
    for (const remaining of [3, 2, 1] as const) {
      const score = target - remaining;
      const warnings = collectVictoryWarnings(state(score - 1, 1, target), state(score, 2, target), recorded);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({ tier: remaining, publicPoints: score, targetPoints: target });
      recorded.push(...warnings);
    }
    expect(victoryWarningTier(target - 4, target)).toBeNull();
    expect(victoryWarningTier(target, target)).toBe(1);
  });

  it("emits only the closest tier on a jump and never repeats after lost/regained points", () => {
    const recorded = collectVictoryWarnings(state(6), state(8), []);
    expect(recorded.map((warning) => warning.tier)).toEqual([2]);
    expect(collectVictoryWarnings(state(8, 8), state(6, 9), recorded)).toEqual([]);
    expect(collectVictoryWarnings(state(6, 9), state(7, 10), recorded)).toEqual([]);
    expect(collectVictoryWarnings(state(7, 10), state(8, 11), recorded)).toEqual([]);
    expect(collectVictoryWarnings(state(8, 11), state(9, 12), recorded).map((warning) => warning.tier)).toEqual([1]);
    expect(collectVictoryWarnings(state(7, 10), state(8, 10), [])).toEqual([]);
  });

  it("does not notify setup, its completion, or a winning transition", () => {
    expect(collectVictoryWarnings(base, { ...state(7), phase: base.phase }, [])).toEqual([]);
    expect(collectVictoryWarnings(base, state(7), [])).toEqual([]);
    expect(collectVictoryWarnings(state(6), { ...state(8), phase: { kind: "finished", winnerId: "p1" } }, [])).toEqual([]);
    const recorded = collectVictoryWarnings(state(6), state(7), []);
    const finished = view({ ...state(10), phase: { kind: "finished", winnerId: "p1" } }, recorded, "p1", [
      { revision: 7, event: { type: "piece_built", playerId: "p1", piece: "settlement", locationId: "v1" } },
    ]);
    expect(finished.effects.some((effect) => effect.kind === "victory-warning")).toBe(false);
    expect(finished.history.some((entry) => entry.type === "victory-warning")).toBe(true);
  });

  it("does not read hidden points, even for the owner, and delivers identical public records to all seats", () => {
    const privateState = { ...state(6, 7), players: state(6).players.map((player) => ({ ...player,
      developmentCards: player.id === "p1" ? [{ id: "hidden", type: "victory-point" as const, acquiredTurn: 0 }] : [],
    })) };
    expect(collectVictoryWarnings(state(6), privateState, [])).toEqual([]);
    const next = { ...privateState, revision: 8, players: privateState.players.map((player) => ({ ...player, visibleVictoryPoints: player.id === "p1" ? 7 : 0 })) };
    const recorded = collectVictoryWarnings(privateState, next, []);
    const projections = base.players.map((player) => view(next, recorded, player.id));
    const warnings = projections.map((projection) => projection.effects.filter((effect) => effect.kind === "victory-warning"));
    expect(warnings[0]).toEqual(warnings[1]);
    expect(warnings[1]).toEqual(warnings[2]);
    expect(projections[1]?.history).toEqual(projections[0]?.history);
    expect(JSON.stringify(warnings)).not.toContain("hidden");
    expect(projections[0]?.history[0]?.message).toContain("7/10");
    expect(projections[0]?.history[0]?.privateDetail).toBeNull();
  });

  it("records all affected players once and orders warning history after the scoring action", () => {
    const after = { ...state(7, 8), players: state(7).players.map((player) => ({ ...player, visibleVictoryPoints: 7 })) };
    const warnings = collectVictoryWarnings(state(6), after, []);
    expect(warnings).toHaveLength(3);
    const records: GameEventRecord[] = [
      { revision: 8, event: { type: "piece_built", playerId: "p1", piece: "city", locationId: "v1" } },
      { revision: 9, event: { type: "trade_offered", playerId: "p1", offerId: "trade" } },
    ];
    const projection = view({ ...after, revision: 9 }, warnings, "p1", records);
    expect(projection.history.map((entry) => entry.type)).toEqual(["piece_built", "victory-warning", "victory-warning", "victory-warning", "trade_offered"]);
    expect(collectVictoryWarnings(state(6), after, warnings)).toEqual([]);
    // The room's full records still deduplicate after old warnings leave the projection window.
    const longHistory = Array.from({ length: 210 }, (_, index): GameEventRecord => ({ revision: index + 10, event: { type: "dice_rolled", playerId: "p1", dice: [1, 1] } }));
    expect(view(state(7, 219), warnings, "p1", longHistory).history.some((entry) => entry.type === "victory-warning")).toBe(false);
    expect(collectVictoryWarnings(state(6, 220), state(7, 221), warnings)).toEqual([]);
  });

  it("does not announce victory for an inactive player with public points at the target", () => {
    const warnings = collectVictoryWarnings(state(6), { ...state(10), phase: { kind: "turn", step: "action", activePlayerId: "p2", turnNumber: 1 } }, []);
    const projection = view(state(10), warnings);
    expect(projection.history[0]?.message).toContain("胜负以回合结算为准");
    expect(projection.history[0]?.message).not.toContain("赢得");
  });
});
