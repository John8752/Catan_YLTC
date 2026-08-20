// @vitest-environment jsdom

import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameCommand, type GameView } from "@catan/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GameControls } from "./GameControls.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

describe("GameControls robber resolution", () => {
  it("replaces the destination dropdown with a board instruction", () => {
    const game = robberView();

    renderControls(game, null, vi.fn());

    expect(screen.getByRole("region", { name: "移动强盗" }).textContent).toContain("在棋盘上选择强盗目的地");
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("shows player buttons only after selecting a target with multiple victims", () => {
    const baseView = robberView();
    if (baseView.interaction.kind !== "robber") throw new Error("Expected robber interaction");
    const selected = baseView.interaction.targets[0];
    if (selected === undefined) throw new Error("Expected a robber destination");
    const game: GameView = {
      ...baseView,
      interaction: {
        ...baseView.interaction,
        targets: baseView.interaction.targets.map((target) => target.hexId === selected.hexId
          ? { ...target, victimIds: ["player_2", "player_3"] }
          : target),
      },
    };
    const onCommand = vi.fn();

    renderControls(game, selected.hexId, onCommand);
    fireEvent.click(screen.getByRole("button", { name: "偷取 周" }));

    expect(screen.getByRole("region", { name: "选择偷取玩家" })).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(onCommand).toHaveBeenCalledWith({
      type: "MoveRobber",
      hexId: selected.hexId,
      victimId: "player_2",
    });
  });
});

function renderControls(
  game: GameView,
  selectedRobberHexId: string | null,
  onCommand: (command: GameCommand) => void,
) {
  return render(
    <GameControls
      game={game}
      busy={false}
      buildMode={null}
      selectedRobberHexId={selectedRobberHexId}
      onCommand={onCommand}
      onBuildModeChange={vi.fn()}
    />,
  );
}

function robberView(): GameView {
  const game = createBaseGame({ id: "game_robber_controls", seed: 42, players: PLAYERS });
  return projectGameForPlayer(robberTurn(game), "player_1");
}

function robberTurn(game: GameState): GameState {
  return {
    ...game,
    phase: {
      kind: "turn",
      activePlayerId: "player_1",
      step: "robber",
      turnNumber: 1,
    },
  };
}
