// @vitest-environment jsdom

import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./Board.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

describe("Board robber interaction", () => {
  it("keeps the robber on the desert initially and exposes map-center destinations", () => {
    const game = robberTurn(createBaseGame({ id: "game_robber_board", seed: 42, players: PLAYERS }));
    const view = projectGameForPlayer(game, "player_1");
    const onRobberHexSelect = vi.fn();

    const { container } = render(
      <Board game={view} onRobberHexSelect={onRobberHexSelect} />,
    );

    const robber = screen.getByRole("img", { name: "强盗位于荒漠" });
    expect(robber.getAttribute("data-robber-hex-id")).toBe(game.map.robberHexId);

    const targets = screen.getAllByRole("button", { name: /将强盗移动到/ });
    expect(targets).toHaveLength(18);
    expect(container.querySelector(`[data-robber-target="${game.map.robberHexId}"]`)).toBeNull();

    fireEvent.click(targets[0] as Element);
    expect(onRobberHexSelect).toHaveBeenLastCalledWith(
      (targets[0] as Element).getAttribute("data-robber-target"),
    );

    fireEvent.keyDown(targets[1] as Element, { key: "Enter" });
    expect(onRobberHexSelect).toHaveBeenLastCalledWith(
      (targets[1] as Element).getAttribute("data-robber-target"),
    );
  });
});

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
