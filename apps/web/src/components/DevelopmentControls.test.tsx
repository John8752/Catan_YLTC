// @vitest-environment jsdom

import { createBaseGame, createGame } from "@catan/game-core";
import type { GameView } from "@catan/protocol";
import { projectGameForPlayer } from "@catan/protocol";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DevelopmentControls } from "./DevelopmentControls.js";

afterEach(() => cleanup());

const HAND = [
  { id: "c_knight", type: "knight" as const, acquiredTurn: 1 },
  { id: "c_road", type: "road-building" as const, acquiredTurn: 1 },
  { id: "c_mono", type: "monopoly" as const, acquiredTurn: 1 },
  { id: "c_plenty", type: "resource-choice" as const, acquiredTurn: 1 },
  { id: "c_vp", type: "victory-point" as const, acquiredTurn: 1 },
];

/** A turn-action view for p1 holding one of every card. */
function handView(overrides: {
  readonly acquiredTurn?: number;
  readonly playedThisTurn?: boolean;
  readonly extended?: boolean;
} = {}): GameView {
  const seats = [
    { id: "p1", name: "自己", color: "terracotta" as const },
    { id: "p2", name: "对手", color: "ocean" as const },
    { id: "p3", name: "三", color: "pine" as const },
    { id: "p4", name: "四", color: "wheat" as const },
    { id: "p5", name: "五", color: "plum" as const },
  ];
  const base = overrides.extended === true
    ? createGame({ id: "dev_cards", seed: 42, players: seats, ruleProfile: "extended-5-6" })
    : createBaseGame({ id: "dev_cards", seed: 42, players: seats.slice(0, 2) });
  const hand = HAND.map((card) => ({ ...card, acquiredTurn: overrides.acquiredTurn ?? card.acquiredTurn }));
  const state = {
    ...base,
    phase: { kind: "turn" as const, activePlayerId: "p1", turnNumber: 4, step: "action" as const, rolled: true },
    developmentCardPlayedThisTurn: overrides.playedThisTurn ?? false,
    players: base.players.map((player) => ({
      ...player,
      developmentCards: player.id === "p1" ? hand : [],
    })),
  };
  return projectGameForPlayer(state as never, "p1");
}

it("does not repeat the table-level rules guide inside the development drawer", () => {
  render(<DevelopmentControls game={handView()} busy={false} onCommand={() => {}} />);

  expect(screen.queryByRole("button", { name: "说明" })).toBeNull();
  expect(screen.queryByRole("button", { name: "规则速查" })).toBeNull();
  expect(screen.queryByText(/移动强盗/)).toBeNull();
});

it("uses resource cards instead of dropdowns for the harvest choice", () => {
  render(<DevelopmentControls game={handView()} busy={false} onCommand={() => {}} />);

  expect(screen.getByRole("combobox", { name: "垄断要抢的资源" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: /丰收/ })).toBeNull();
  expect(screen.getAllByRole("button", { name: /在丰收资源中加入 1 张/ })).toHaveLength(5);
});

it("requires two harvest cards, submits them and clears the selection", () => {
  const onCommand = vi.fn();
  render(<DevelopmentControls game={handView()} busy={false} onCommand={onCommand} />);

  const plentyCard = screen.getByText("丰收").closest(".development-card");
  if (plentyCard === null) throw new Error("Missing harvest card");
  const harvest = within(plentyCard as HTMLElement);
  const confirm = harvest.getByRole("button", { name: "确定" });
  expect((confirm as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(harvest.getByRole("button", { name: /在丰收资源中加入 1 张砖/ }));
  expect((confirm as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(harvest.getByRole("button", { name: /在丰收资源中加入 1 张羊/ }));
  expect((confirm as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(confirm);

  expect(onCommand).toHaveBeenCalledWith({
    type: "PlayResourceChoice",
    cardId: "c_plenty",
    resources: ["brick", "wool"],
  });
  expect(harvest.getByText("选择 2 张资源 · 已选 0/2")).toBeTruthy();
});

it("allows harvest to choose two cards of the same resource", () => {
  const onCommand = vi.fn();
  render(<DevelopmentControls game={handView()} busy={false} onCommand={onCommand} />);

  const plentyCard = screen.getByText("丰收").closest(".development-card");
  if (plentyCard === null) throw new Error("Missing harvest card");
  const harvest = within(plentyCard as HTMLElement);
  const addOre = harvest.getByRole("button", { name: /在丰收资源中加入 1 张矿/ });
  fireEvent.click(addOre);
  fireEvent.click(addOre);
  fireEvent.click(harvest.getByRole("button", { name: "确定" }));

  expect(onCommand).toHaveBeenCalledWith({
    type: "PlayResourceChoice",
    cardId: "c_plenty",
    resources: ["ore", "ore"],
  });
});

it("puts the reason on a disabled card instead of only greying it out", () => {
  const { unmount } = render(<DevelopmentControls game={handView({ acquiredTurn: 4 })} busy={false} onCommand={() => {}} />);
  for (const button of screen.getAllByRole("button", { name: "使用" })) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("title")).toBe("本回合刚买到，下回合才能用");
  }
  unmount();

  render(<DevelopmentControls game={handView({ playedThisTurn: true })} busy={false} onCommand={() => {}} />);
  for (const button of screen.getAllByRole("button", { name: "使用" })) {
    expect(button.getAttribute("title")).toBe("本回合已经用过一张发展卡");
  }
});

it("leaves a playable card unexplained and enabled", () => {
  render(<DevelopmentControls game={handView()} busy={false} onCommand={() => {}} />);

  // The victory point card never gets a button; the harvest card uses a separate confirmation label.
  const buttons = screen.getAllByRole("button", { name: "使用" });
  expect(buttons).toHaveLength(3);
  for (const button of buttons) {
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("title")).toBeNull();
  }
  expect((screen.getByRole("button", { name: "确定" }) as HTMLButtonElement).disabled).toBe(true);
});
