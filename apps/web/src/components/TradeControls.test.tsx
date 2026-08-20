// @vitest-environment jsdom

import { createBaseGame, resourceAmounts, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameCommand } from "@catan/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TradeControls } from "./TradeControls.js";

const players = [
  { id: "player_1", name: "林", color: "terracotta" as const },
  { id: "player_2", name: "岚", color: "ocean" as const },
  { id: "player_3", name: "舟", color: "pine" as const },
];

afterEach(() => cleanup());

describe("TradeControls", () => {
  it("composes a player offer from multiple resource types", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<TradeControls game={composerView({ brick: 2, lumber: 1 })} busy={false} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "发起交易" }));
    const publish = screen.getByRole("button", { name: "向所有玩家发布报价" }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);

    fireEvent.change(screen.getByRole("spinbutton", { name: "你提供：砖数量" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "你提供：木数量" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "你希望获得：麦数量" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "你希望获得：矿数量" }), { target: { value: "2" } });
    expect(publish.disabled).toBe(false);
    fireEvent.click(publish);

    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: "OpenTradeOffer",
      give: resourceAmounts({ brick: 2, lumber: 1 }),
      receive: resourceAmounts({ grain: 1, ore: 2 }),
    }));
  });

  it("allows either side of a player offer to contain no resources", () => {
    const requestCommand = vi.fn<(command: GameCommand) => void>();
    const requestView = render(
      <TradeControls game={composerView({ brick: 1 })} busy={false} onCommand={requestCommand} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "发起交易" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "你希望获得：矿数量" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "向所有玩家发布报价" }));
    expect(requestCommand).toHaveBeenCalledWith(expect.objectContaining({
      give: resourceAmounts({}),
      receive: resourceAmounts({ ore: 1 }),
    }));
    requestView.unmount();

    const giftCommand = vi.fn<(command: GameCommand) => void>();
    render(<TradeControls game={composerView({ brick: 1 })} busy={false} onCommand={giftCommand} />);
    fireEvent.click(screen.getByRole("button", { name: "发起交易" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "你提供：砖数量" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "向所有玩家发布报价" }));
    expect(giftCommand).toHaveBeenCalledWith(expect.objectContaining({
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({}),
    }));
  });

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

function composerView(resources: Partial<GameState["players"][number]["resources"]>) {
  const base = createBaseGame({ id: "game_trade_composer", seed: 87, players });
  const state: GameState = {
    ...base,
    phase: { kind: "turn", activePlayerId: "player_1", step: "action", turnNumber: 1 },
    players: base.players.map((player) => ({
      ...player,
      resources: player.id === "player_1" ? resourceAmounts(resources) : player.resources,
    })),
  };
  return projectGameForPlayer(state, "player_1");
}

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
