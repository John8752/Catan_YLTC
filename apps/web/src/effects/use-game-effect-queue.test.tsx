// @vitest-environment jsdom

import { createBaseGame, resourceAmounts } from "@catan/game-core";
import { projectGameForPlayer, type PublicGameEffectView } from "@catan/protocol";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGameEffectQueue } from "./use-game-effect-queue.js";

const effect: PublicGameEffectView = {
  id: "7:resources-produced",
  revision: 7,
  kind: "resource-grant",
  reason: "production",
  grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 1 }) }],
  sources: [{ playerId: "player_1", resource: "grain", amount: 1, hexId: "hex_1", vertexId: "vertex_1" }],
  triggeredHexIds: ["hex_1"],
};

describe("useGameEffectQueue", () => {
  it("does not replay an initial snapshot and deduplicates repeated live revisions", () => {
    const initial = gameView(6, []);
    const { result, rerender } = renderHook(
      ({ game }) => useGameEffectQueue(game),
      { initialProps: { game: initial } },
    );
    expect(result.current.activeEffect).toBeNull();

    const live = gameView(7, [effect]);
    rerender({ game: live });
    expect(result.current.activeEffect?.id).toBe(effect.id);

    rerender({ game: live });
    act(() => result.current.completeActiveEffect());
    expect(result.current.activeEffect).toBeNull();
  });

  it("queues a card reveal before its same-revision resource result", () => {
    const reveal: PublicGameEffectView = {
      id: "8:development-card:player_1:resource-choice",
      revision: 8,
      kind: "development-card-play",
      playerId: "player_1",
      card: { type: "resource-choice", resources: resourceAmounts({ grain: 1, ore: 1 }) },
    };
    const grant: PublicGameEffectView = {
      id: "8:resource-choice:player_1",
      revision: 8,
      kind: "resource-grant",
      reason: "resource-choice",
      grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 1, ore: 1 }), origin: { kind: "bank" } }],
      sources: [],
      triggeredHexIds: [],
    };
    const { result, rerender } = renderHook(
      ({ game }) => useGameEffectQueue(game),
      { initialProps: { game: gameView(7, []) } },
    );

    rerender({ game: gameView(8, [reveal, grant]) });
    expect(result.current.activeEffect?.id).toBe(reveal.id);
    act(() => result.current.completeActiveEffect());
    expect(result.current.activeEffect?.id).toBe(grant.id);
    act(() => result.current.completeActiveEffect());
    expect(result.current.activeEffect).toBeNull();
  });
});

function gameView(revision: number, effects: readonly PublicGameEffectView[]) {
  const game = createBaseGame({
    id: "game_effect_queue",
    seed: 21,
    players: [
      { id: "player_1", name: "林", color: "terracotta" },
      { id: "player_2", name: "岚", color: "ocean" },
      { id: "player_3", name: "舟", color: "pine" },
    ],
  });
  return { ...projectGameForPlayer({ ...game, revision }, "player_1"), effects };
}
