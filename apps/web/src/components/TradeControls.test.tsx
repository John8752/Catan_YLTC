// @vitest-environment jsdom

import { createBaseGame, resourceAmounts, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameCommand } from "@catan/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TradeControls } from "./TradeControls.js";
import { ActiveTradePanel } from "./ActiveTradePanel.js";

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

    fireEvent.click(screen.getByRole("button", { name: /在我提供中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我提供中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我提供中加入 1 张木/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我希望获得中加入 1 张麦/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我希望获得中加入 1 张矿/ }));
    fireEvent.click(screen.getByRole("button", { name: /在我希望获得中加入 1 张矿/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /在我希望获得中加入 1 张矿/ }));
    fireEvent.click(screen.getByRole("button", { name: "向所有玩家发布报价" }));
    expect(requestCommand).toHaveBeenCalledWith(expect.objectContaining({
      give: resourceAmounts({}),
      receive: resourceAmounts({ ore: 1 }),
    }));
    requestView.unmount();

    const giftCommand = vi.fn<(command: GameCommand) => void>();
    render(<TradeControls game={composerView({ brick: 1 })} busy={false} onCommand={giftCommand} />);
    fireEvent.click(screen.getByRole("button", { name: "发起交易" }));
    fireEvent.click(screen.getByRole("button", { name: /在我提供中加入 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: "向所有玩家发布报价" }));
    expect(giftCommand).toHaveBeenCalledWith(expect.objectContaining({
      give: resourceAmounts({ brick: 1 }),
      receive: resourceAmounts({}),
    }));
  });

  it("shows every response and lets the proposer choose an accepted partner", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<ActiveTradePanel game={tradeView("player_1")} busy={false} onCommand={onCommand} />);

    expect(screen.getByRole("region", { name: "等待桌上回应" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "岚：同意交易" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "舟：拒绝交易" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "岚：同意交易" }));
    fireEvent.click(screen.getByRole("button", { name: "与所选玩家成交" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "CompleteTradeOffer",
      offerId: "offer_1",
      partnerId: "player_2",
    });
  });

  it("records a responder decision without completing the transfer", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<ActiveTradePanel game={tradeView("player_3")} busy={false} onCommand={onCommand} />);

    expect(screen.getByText("你已拒绝，仍可修改回应")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "同意" }));

    expect(onCommand).toHaveBeenCalledWith({ type: "AcceptTradeOffer", offerId: "offer_1" });
    expect(onCommand).not.toHaveBeenCalledWith(expect.objectContaining({ type: "CompleteTradeOffer" }));
  });

  it("disables responses and counteroffer submissions that are already public", () => {
    const accepted = render(<ActiveTradePanel game={tradeView("player_2")} busy={false} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: "同意" }) as HTMLButtonElement).disabled).toBe(true);
    accepted.unmount();

    const declined = render(<ActiveTradePanel game={tradeView("player_3")} busy={false} onCommand={vi.fn()} />);
    expect((screen.getByRole("button", { name: "拒绝" }) as HTMLButtonElement).disabled).toBe(true);
    declined.unmount();

    render(<ActiveTradePanel game={counterTradeView("player_2")} busy={false} onCommand={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "反报价" }));
    expect((screen.getByRole("button", { name: "提交反报价" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets a responder compose and replace their response with a counteroffer", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<ActiveTradePanel game={tradeView("player_2")} busy={false} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "反报价" }));
    fireEvent.click(screen.getByRole("button", { name: /从反报价中你希望获得移除 1 张砖/ }));
    fireEvent.click(screen.getByRole("button", { name: /在反报价中你希望获得中加入 1 张木/ }));
    fireEvent.click(screen.getByRole("button", { name: "提交反报价" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "CounterTradeOffer",
      offerId: "offer_1",
      proposerGives: resourceAmounts({ lumber: 1 }),
      proposerReceives: resourceAmounts({ ore: 1 }),
    });
  });

  it("shows counteroffer terms and lets the proposer accept them", () => {
    const onCommand = vi.fn<(command: GameCommand) => void>();
    render(<ActiveTradePanel game={counterTradeView("player_1")} busy={false} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: "岚：提出反报价" }));
    fireEvent.click(screen.getByRole("button", { name: "接受所选反报价" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "CompleteTradeOffer",
      offerId: "offer_1",
      partnerId: "player_2",
    });
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

function counterTradeView(viewerId: string) {
  const view = tradeView(viewerId);
  if (view.openTrade === null) throw new Error("Missing open trade");
  return {
    ...view,
    openTrade: {
      ...view.openTrade,
      responses: [
        {
          playerId: "player_2",
          response: "countered" as const,
          proposerGives: resourceAmounts({ brick: 1 }),
          proposerReceives: resourceAmounts({ ore: 1 }),
        },
        { playerId: "player_3", response: "declined" as const },
      ],
    },
  };
}
