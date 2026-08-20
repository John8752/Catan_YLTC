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
    expect(markup).toContain("群岛初现");
  });
});
