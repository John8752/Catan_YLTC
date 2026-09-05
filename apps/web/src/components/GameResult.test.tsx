// @vitest-environment jsdom

import { createBaseGame, resourceAmounts, type GameEventRecord, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type CatanSettlementV1 } from "@catan/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatanResultPanel, GameResult } from "./GameResult.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

describe("GameResult", () => {
  it("renders deterministic winner copy and navigable end-game statistics", () => {
    const base = createBaseGame({ id: "game_result", seed: 91, players: PLAYERS });
    const state: GameState = {
      ...base,
      phase: { kind: "finished", winnerId: "player_1" },
      buildings: [
        { ownerId: "player_1", vertexId: base.map.vertices[0]?.id ?? "vertex_0", kind: "city" },
        { ownerId: "player_1", vertexId: base.map.vertices[1]?.id ?? "vertex_1", kind: "settlement" },
      ],
      awards: {
        longestRoad: { holderId: "player_1", value: 6 },
        largestArmy: { holderId: "player_1", value: 3 },
      },
      players: base.players.map((player) => player.id === "player_1"
        ? { ...player, visibleVictoryPoints: 8, resources: resourceAmounts({ grain: 1 }) }
        : player),
    };
    const records = [
      { revision: 2, event: { type: "dice_rolled", playerId: "player_1", dice: [3, 4] } },
      { revision: 3, event: { type: "resources_produced", total: 2, grants: [{ playerId: "player_1", resources: resourceAmounts({ grain: 2 }) }], sources: [], triggeredHexIds: [] } },
      { revision: 4, event: { type: "piece_built", playerId: "player_1", piece: "road", locationId: "edge_0" } },
    ] satisfies GameEventRecord[];
    const game = projectGameForPlayer(state, "player_1", records);

    const { rerender } = render(<GameResult game={game} />);

    expect(screen.getByRole("heading", { name: "林 赢得群岛" })).not.toBeNull();
    expect(screen.getByText(/海陆双冠/)).not.toBeNull();
    expect(screen.getByText(/暗藏的发展成果完成致胜一击/)).not.toBeNull();
    activateTab("骰子统计");
    expect(screen.getByLabelText("骰子点数出现次数").textContent).toContain("7");
    activateTab("资源统计");
    expect(screen.getByRole("columnheader", { name: "骰产合计" })).not.toBeNull();
    expect(screen.getByRole("rowheader", { name: /林/ })).not.toBeNull();

    const tabs = ["概览", "骰子统计", "资源卡统计", "活动统计", "资源统计"];
    const liveText = tabs.map((name) => {
      activateTab(name);
      return screen.getByRole("tabpanel").textContent;
    });
    const saved: CatanSettlementV1 = {
      ruleProfile: "base-3-4", winnerId: "player_1", victoryPointsToWin: game.victoryPointsToWin,
      players: PLAYERS, summary: game.summary!,
    };
    rerender(<CatanResultPanel result={JSON.parse(JSON.stringify(saved)) as CatanSettlementV1} />);
    expect(screen.queryByRole("button", { name: "查看棋盘" })).toBeNull();
    expect(screen.getByRole("heading", { name: "林 赢得群岛" })).not.toBeNull();
    tabs.forEach((name, index) => {
      activateTab(name);
      expect(screen.getByRole("tabpanel").textContent).toBe(liveText[index]);
    });
  });
});

function activateTab(name: string): void {
  const tab = screen.getByRole("tab", { name });
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}
