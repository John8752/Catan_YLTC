import { createBaseGame, createGame } from "@catan/game-core/catan";
import { projectGameForPlayer } from "@catan/protocol/catan";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OpponentStrip } from "./OpponentStrip.js";

it("shows every opponent's public supply and road statistics", () => {
  const game = createBaseGame({
    id: "game_opponent_status",
    seed: 94,
    players: [
      { id: "player_1", name: "林", color: "terracotta" },
      { id: "player_2", name: "超级漫长玩家名称", color: "ocean" },
      { id: "player_3", name: "舟", color: "pine" },
    ],
  });
  const firstEdge = game.map.edges[0];
  const secondEdge = firstEdge === undefined
    ? undefined
    : game.map.edges.find((edge) => edge.id !== firstEdge.id && edge.vertexIds.some((vertexId) => firstEdge.vertexIds.includes(vertexId)));
  if (firstEdge === undefined || secondEdge === undefined) throw new Error("Map needs connected test edges");
  const publicState = {
    ...game,
    roads: [
      { ownerId: "player_2", edgeId: firstEdge.id },
      { ownerId: "player_2", edgeId: secondEdge.id },
    ],
    players: game.players.map((player) => player.id === "player_2"
      ? {
          ...player,
          pieces: { roads: 13, settlements: 3, cities: 4 },
          playedKnights: 2,
        }
      : player),
  };

  const markup = renderToStaticMarkup(<OpponentStrip game={projectGameForPlayer(publicState, "player_1")} />);

  expect(markup).toContain('data-opponent-summary="player_2"');
  expect(markup).toContain('data-opponent-supply="player_2"');
  expect(markup).toContain('title="超级漫长玩家名称"');
  expect(markup).toContain("超级漫长玩家…");
  expect(markup).toContain("剩余道路 13");
  expect(markup).toContain("剩余村庄 3");
  expect(markup).toContain("剩余城市 4");
  expect(markup).toContain("已出骑士 2");
  expect(markup).toContain("最长道路长度 2");
});

it("lists the local seat in order and marks the server-projected next actor", () => {
  const players = ["p1", "p2", "p3", "p4", "p5", "p6"].map((id, index) => ({ id, name: `座位${index + 1}号玩家`, color: (["terracotta", "ocean", "pine", "wheat", "plum", "charcoal"] as const)[index]! }));
  const base = createGame({ id: "seat_order", seed: 42, players, ruleProfile: "extended-5-6" });
  const game = projectGameForPlayer({ ...base, phase: { kind: "turn", activePlayerId: "p2", step: "action", turnNumber: 3 } }, "p1");

  const markup = renderToStaticMarkup(<OpponentStrip game={game} />);

  expect(markup.match(/data-seat-of="/g)).toHaveLength(6);
  expect(markup).toMatch(/data-seat-of="p1" data-seat-self="true"|data-seat-of="p1"[^>]*data-seat-self="true"/);
  expect(markup).toMatch(/data-seat-of="p2" data-seat-active="true"/);
  // After p2's primary turn comes the paired action three seats on, not p3.
  expect(markup).toMatch(/data-seat-of="p5"[^>]*data-seat-next="paired"/);
  expect(markup).toContain("下一位行动（搭档行动）");
  // Six seats share a phone row: two whole characters, full name kept in the title.
  expect(markup).toContain(">座位<");
  expect(markup).toContain('title="座位2号玩家"');
});
