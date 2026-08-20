import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Board } from "./Board.js";

describe("Board", () => {
  it("renders every game hex as an SVG target", () => {
    const game = createBaseGame({
      id: "game_1",
      seed: 42,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const markup = renderToStaticMarkup(<Board game={projectGameForPlayer(game, "player_1")} />);

    expect(markup.match(/data-hex-id=/g)).toHaveLength(19);
    expect(markup.match(/data-vertex-id=/g)).toHaveLength(54);
    expect(markup.match(/data-edge-id=/g)).toHaveLength(72);
    expect(markup.match(/data-port-id=/g)).toHaveLength(9);
    expect(markup.match(/data-port-sign=/g)).toHaveLength(9);
    expect(markup.match(/data-probability-pips=/g)).toHaveLength(18);
    expect(markup.match(/data-probability-pips="5"/g)).toHaveLength(4);
    expect(markup.match(/data-tile-resource-icon="wool"/g)).toHaveLength(4);
    expect(markup).toContain('data-port-resource="wool"');
    expect(markup.match(/data-robber-piece=/g)).toHaveLength(1);
    expect(markup).toContain("强盗位于荒漠");
    expect(markup).toContain("群岛初现");
  });

  it("renders roads, villages and cities as distinct player-colored silhouettes", () => {
    const game = createBaseGame({
      id: "game_pieces",
      seed: 43,
      players: [
        { id: "player_1", name: "林", color: "terracotta" },
        { id: "player_2", name: "周", color: "ocean" },
        { id: "player_3", name: "陈", color: "pine" },
      ],
    });
    const firstVertex = game.map.vertices[0]?.id;
    const secondVertex = game.map.vertices[2]?.id;
    const firstEdge = game.map.edges[0]?.id;
    if (firstVertex === undefined || secondVertex === undefined || firstEdge === undefined) throw new Error("Missing map locations");
    const withPieces = {
      ...game,
      buildings: [
        { ownerId: "player_1", vertexId: firstVertex, kind: "settlement" as const },
        { ownerId: "player_2", vertexId: secondVertex, kind: "city" as const },
      ],
      roads: [{ ownerId: "player_3", edgeId: firstEdge }],
    };
    const markup = renderToStaticMarkup(<Board game={projectGameForPlayer(withPieces, "player_1")} />);

    expect(markup).toContain('data-piece-kind="road"');
    expect(markup).toContain('data-piece-kind="settlement"');
    expect(markup).toContain('data-piece-kind="city"');
    expect(markup).toContain("piece-color-terracotta");
    expect(markup).toContain("piece-color-ocean");
    expect(markup).toContain("piece-color-pine");
    expect(markup).toContain("林的村庄");
    expect(markup).toContain("周的城市");
  });
});
