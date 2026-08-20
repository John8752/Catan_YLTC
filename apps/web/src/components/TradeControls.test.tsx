// @vitest-environment jsdom

import { createBaseGame, resourceAmounts, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameCommand } from "@catan/protocol";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TradeControls } from "./TradeControls.js";

const players = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "岚", color: "ocean" as const },
  { id: "player_3", name: "舟", color: "pine" as const },
];

describe("TradeControls", () => {
  it("shows every response and lets the proposer choose an accepted partner", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<TradeControls game={tradeView("player_1")} busy={false} onCommand={onCommand} />);

    expect(screen.getByRole("dialog", { name: "等待玩家回应" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /岚.*同意交易/ })).toBeTruthy();
    expect((screen.getByRole("button", { name: /舟.*拒绝交易/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /岚.*同意交易/ }));
    fireEvent.click(screen.getByRole("button", { name: "与所选玩家成交" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "CompleteTradeOffer",
      offerId: "offer_1",
      partnerId: "player_2",
    });
  });

  it("records a responder decision without completing the transfer", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<TradeControls game={tradeView("player_3")} busy={false} onCommand={onCommand} />);

    expect(screen.getByText("你已拒绝，可以改为同意")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "同意" }));

    expect(onCommand).toHaveBeenCalledWith({ type: "AcceptTradeOffer", offerId: "offer_1" });
    expect(onCommand).not.toHaveBeenCalledWith(expect.objectContaining({ type: "CompleteTradeOffer" }));
  });
});

function tradeView(viewerId: string) {
  const base = createBaseGame({ id: "game_trade_ui", seed: 88, players });
  const state: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 },
    players: base.players.map((player) => ({
      ...player,
      resources: resourceAmounts(player.id === "player_1" ? { brick: 2 } : { ore: 2 }),
    })),
    openTrade: {
      offerId: "offer_1",
      proposerId: "player_1",
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({ ore: 1 }),
      responses: [
        { playerId: "player_2", response: "accepted" },
        { playerId: "player_3", response: "declined" },
      ],
    },
  };
  return projectGameForPlayer(state, viewerId);
}
