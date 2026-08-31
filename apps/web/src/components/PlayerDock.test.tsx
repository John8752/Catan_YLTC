import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PlayerDock } from "./PlayerDock.js";
import { OpponentStrip } from "./OpponentStrip.js";

it.each([0, 4, 10])("shows the local public score %i in the same badge as opponents", (score) => {
  const base = createBaseGame({ id: "score_badge", seed: 42, players: [
    { id: "p1", name: "自己", color: "terracotta" },
    { id: "p2", name: "对手", color: "ocean" },
    { id: "p3", name: "玩家三", color: "pine" },
  ] });
  const game = projectGameForPlayer({ ...base, players: base.players.map((player) => ({
    ...player, visibleVictoryPoints: score,
    developmentCards: player.id === "p1" ? [{ id: "hidden_vp", type: "victory-point" as const, acquiredTurn: 1 }] : [],
  })) }, "p1");
  const dock = renderToStaticMarkup(<PlayerDock game={game} busy={false} buildMode={null} selectedRobberHexId={null} onBuildModeChange={() => undefined} onCommand={() => undefined} />);
  const opponents = renderToStaticMarkup(<OpponentStrip game={game} />);
  expect(dock).toContain('data-player-score="p1"');
  expect(dock).toContain(`aria-label="自己，公开分数 ${score} 分"`);
  expect(opponents).toContain(`aria-label="对手，公开分数 ${score} 分"`);
  expect(dock).toContain("公开分数，不含隐藏胜利点");
  expect(dock).not.toContain(`公开分数 ${score + 1} 分`);
});
