// @vitest-environment jsdom

import { createBaseGame, resourceAmounts, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameCommand } from "@catan/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerDock } from "./PlayerDock.js";

const players = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "岚", color: "ocean" as const },
  { id: "player_3", name: "舟", color: "pine" as const },
];

afterEach(() => cleanup());

describe("PlayerDock resource cards", () => {
  it("uses the persistent hand cards to select and remove an exact discard", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    renderDock(discardView(), onCommand);

    fireEvent.click(screen.getByRole("button", { name: /在准备弃掉中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: /在准备弃掉中加入 1 张砖/ }));
    expect(screen.getByRole("button", { name: /从准备弃掉移除 1 张砖，当前 2 张/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /从准备弃掉移除 1 张砖，当前 2 张/ }));
    expect((screen.getByRole("button", { name: "确认弃牌" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /在准备弃掉中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: "确认弃牌" }));

    expect(onCommand).toHaveBeenCalledWith({ type: "DiscardResources", resources: resourceAmounts({ brick: 2 }) });
  });

  it("uses the persistent hand cards as the give source for a player offer", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    renderDock(actionView(), onCommand);

    fireEvent.click(screen.getByRole("button", { name: "发起交易" }));
    fireEvent.click(screen.getByRole("button", { name: /在我提供中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我希望获得中加入 1 张矿/ }));
    fireEvent.click(screen.getByRole("button", { name: "向所有玩家发布报价" }));

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "OpenTradeOffer",
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({ ore: 1 }),
    }));
  });
});

function renderDock(game: ReturnType<typeof projectGameForPlayer>, onCommand: (command: GameCommand) => void) {
  return render(
    <PlayerDock
      game={game}
      busy={false}
      onCommand={onCommand}
      buildMode={null}
      selectedRobberHexId={null}
      onBuildModeChange={() => undefined}
    />,
  );
}

function discardView() {
  const base = createBaseGame({ id: "game_discard_cards", seed: 91, players });
  const state: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId: "player_1", step: "discard", turnNumber: 1 },
    pendingDiscards: [{ playerId: "player_1", count: 2 }],
    players: base.players.map((player) => ({
      ...player,
      resources: player.id === "player_1" ? resourceAmounts({ brick: 4, ore: 1 }) : player.resources,
    })),
  };
  return projectGameForPlayer(state, "player_1");
}

function actionView() {
  const base = createBaseGame({ id: "game_trade_hand_cards", seed: 92, players });
  const state: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 },
    players: base.players.map((player) => ({
      ...player,
      resources: player.id === "player_1" ? resourceAmounts({ brick: 2 }) : player.resources,
    })),
  };
  return projectGameForPlayer(state, "player_1");
}
