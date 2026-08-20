// @vitest-environment jsdom

import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameView } from "@catan/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./Board.js";

const PLAYERS = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "周", color: "ocean" as const },
  { id: "player_3", name: "陈", color: "pine" as const },
];

describe("Board construction targets", () => {
  it("shows each selected build mode as an actionable map overlay", () => {
    const game = constructionView();
    if (game.interaction.kind !== "turn-action") throw new Error("Expected turn action interaction");
    const roadId = game.interaction.roadEdgeIds[0];
    const settlementId = game.interaction.settlementVertexIds[0];
    const cityId = game.interaction.cityVertexIds[0];
    if (roadId === undefined || settlementId === undefined || cityId === undefined) {
      throw new Error("Missing construction targets");
    }
    const onCommand = vi.fn();
    const { container, rerender } = render(
      <Board game={game} buildMode={null} onCommand={onCommand} />,
    );

    expect(container.querySelectorAll("[data-build-target-kind]")).toHaveLength(0);

    rerender(<Board game={game} buildMode="road" onCommand={onCommand} />);
    const roadTarget = screen.getByRole("button", { name: "在这里建造道路" });
    expect(roadTarget.getAttribute("data-build-target-id")).toBe(roadId);
    expect(roadTarget.compareDocumentPosition(container.querySelector(".placed-buildings") as Node))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(roadTarget);
    expect(onCommand).toHaveBeenLastCalledWith({ type: "BuildRoad", edgeId: roadId });

    rerender(<Board game={game} buildMode="settlement" onCommand={onCommand} />);
    const settlementTarget = screen.getByRole("button", { name: "在这里建造村庄" });
    expect(settlementTarget.getAttribute("data-build-target-id")).toBe(settlementId);
    expect(settlementTarget.getAttribute("data-build-target-context")).toBe("build");
    expect(settlementTarget.classList.contains("construction-target-setup")).toBe(false);
    fireEvent.keyDown(settlementTarget, { key: "Enter" });
    expect(onCommand).toHaveBeenLastCalledWith({ type: "BuildSettlement", vertexId: settlementId });

    rerender(<Board game={game} buildMode="city" onCommand={onCommand} />);
    const cityTarget = screen.getByRole("button", { name: "在这里升级城市" });
    expect(cityTarget.getAttribute("data-build-target-id")).toBe(cityId);
    expect(cityTarget.querySelector(".construction-target-upgrade-mark")).toBeTruthy();
    expect(container.querySelector(".placed-buildings")?.compareDocumentPosition(cityTarget) ?? 0)
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(cityTarget);
    expect(onCommand).toHaveBeenLastCalledWith({ type: "BuildCity", vertexId: cityId });
  });

  it("keeps initial placement targets on the same overlay system", () => {
    const game = createBaseGame({ id: "game_setup_targets", seed: 45, players: PLAYERS });
    const onCommand = vi.fn();
    render(<Board game={projectGameForPlayer(game, "player_1")} onCommand={onCommand} />);

    const target = screen.getAllByRole("button", { name: "在这里放置定居点" })[0];
    if (target === undefined) throw new Error("Missing initial settlement target");
    fireEvent.click(target);

    expect(target.getAttribute("data-build-target-kind")).toBe("settlement");
    expect(target.getAttribute("data-build-target-context")).toBe("setup");
    expect(target.classList.contains("construction-target-setup")).toBe(true);
    expect(target.querySelector(".construction-target-vertex-ring")?.getAttribute("r")).toBe("7");
    expect(onCommand).toHaveBeenCalledWith({
      type: "PlaceInitialSettlement",
      vertexId: target.getAttribute("data-build-target-id"),
    });
  });
});

function constructionView(): GameView {
  const base = createBaseGame({ id: "game_build_targets", seed: 44, players: PLAYERS });
  const game: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 },
  };
  const view = projectGameForPlayer(game, "player_1");
  const roadId = view.map.edges[0]?.id;
  const settlementId = view.map.vertices[0]?.id;
  const cityId = view.map.vertices[2]?.id;
  if (roadId === undefined || settlementId === undefined || cityId === undefined) {
    throw new Error("Missing map locations");
  }
  return {
    ...view,
    buildings: [{ ownerId: "player_1", vertexId: cityId, kind: "settlement" }],
    interaction: {
      kind: "turn-action",
      instruction: "你可以交易、建造或结束回合",
      vertexIds: [],
      edgeIds: [],
      roadEdgeIds: [roadId],
      settlementVertexIds: [settlementId],
      cityVertexIds: [cityId],
    },
  };
}
