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

function openCard(label: string) {
  const card = within(screen.getByText(label).closest(".development-card") as HTMLElement);
  fireEvent.click(card.getByRole("button", { name: "使用" }));
  return within(screen.getByRole("dialog"));
}

it("keeps every resource selector out of the sidebar and shows it only inside its card dialog", () => {
  render(<DevelopmentControls game={handView()} busy={false} onCommand={() => {}} />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("button", { name: /在丰收资源中加入/ })).toBeNull();
  expect(screen.getAllByRole("button", { name: "使用" })).toHaveLength(4);
  const dialog = openCard("丰收");
  expect(dialog.getAllByRole("button", { name: /在丰收资源中加入 1 张/ })).toHaveLength(5);
  expect(dialog.queryByRole("combobox")).toBeNull();
});

it("requires two harvest resources in the dialog, submits once and clears selection", () => {
  const onCommand = vi.fn();
  render(<DevelopmentControls game={handView()} busy={false} onCommand={onCommand} />);
  const harvest = openCard("丰收");
  const confirm = harvest.getByRole("button", { name: "确认使用" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.click(harvest.getByRole("button", { name: /在丰收资源中加入 1 张砖/ }));
  expect(confirm.disabled).toBe(true);
  fireEvent.click(harvest.getByRole("button", { name: /在丰收资源中加入 1 张羊/ }));
  expect(confirm.disabled).toBe(false);
  expect(onCommand).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PlayResourceChoice", cardId: "c_plenty", resources: ["brick", "wool"] });
  expect(openCard("丰收").getByText("选择 2 张资源 · 已选 0/2")).toBeTruthy();
});

it("allows two identical harvest resources and respects the visible bank limit", () => {
  const onCommand = vi.fn();
  const game = handView();
  render(<DevelopmentControls game={{ ...game, bankResources: { ...game.bankResources!, brick: 0, wool: 1 } }} busy={false} onCommand={onCommand} />);
  const harvest = openCard("丰收");
  expect((harvest.getByRole("button", { name: /在丰收资源中加入 1 张砖/ }) as HTMLButtonElement).disabled).toBe(true);
  const ore = harvest.getByRole("button", { name: /在丰收资源中加入 1 张矿/ });
  fireEvent.click(ore); fireEvent.click(ore);
  fireEvent.click(harvest.getByRole("button", { name: "确认使用" }));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PlayResourceChoice", cardId: "c_plenty", resources: ["ore", "ore"] });
});

it("uses the monopoly resource selected inside the dialog", () => {
  const onCommand = vi.fn();
  render(<DevelopmentControls game={handView()} busy={false} onCommand={onCommand} />);
  const dialog = openCard("垄断");
  fireEvent.change(dialog.getByRole("combobox", { name: "垄断要抢的资源" }), { target: { value: "brick" } });
  expect(screen.getByRole("dialog").textContent).toContain("「砖」");
  expect(onCommand).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button", { name: "确认使用" }));
  expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: "PlayMonopoly", cardId: "c_mono", resource: "brick" });
});

it.each([
  ["骑士", { type: "PlayKnight", cardId: "c_knight" }],
  ["道路建设", { type: "PlayRoadBuilding", cardId: "c_road" }],
  ["垄断", { type: "PlayMonopoly", cardId: "c_mono", resource: "ore" }],
] as const)("requires confirmation for %s and cancellation never plays it", (label, command) => {
  const onCommand = vi.fn();
  render(<DevelopmentControls game={handView()} busy={false} onCommand={onCommand} />);
  const card = within(screen.getByText(label).closest(".development-card") as HTMLElement);
  fireEvent.click(card.getByRole("button", { name: "使用" }));
  expect(onCommand).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { name: `确认使用${label}？` })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(onCommand).not.toHaveBeenCalled();
  fireEvent.click(card.getByRole("button", { name: "使用" }));
  const confirm = screen.getByRole("button", { name: "确认使用" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(onCommand).toHaveBeenCalledExactlyOnceWith(command);
});

it("keeps harvest choices on cancel and dismisses confirmation after a new game revision", () => {
  const onCommand = vi.fn();
  const game = handView();
  const { rerender } = render(<DevelopmentControls game={game} busy={false} onCommand={onCommand} />);
  const dialog = openCard("丰收");
  fireEvent.click(dialog.getByRole("button", { name: /在丰收资源中加入 1 张砖/ }));
  fireEvent.click(dialog.getByRole("button", { name: /在丰收资源中加入 1 张羊/ }));
  fireEvent.click(dialog.getByRole("button", { name: "取消" }));
  expect(openCard("丰收").getByText("选择 2 张资源 · 已选 2/2")).toBeTruthy();
  rerender(<DevelopmentControls game={{ ...game, revision: game.revision + 1 }} busy={false} onCommand={onCommand} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onCommand).not.toHaveBeenCalled();
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

  // Only the passive victory point card has no use button.
  const buttons = screen.getAllByRole("button", { name: "使用" });
  expect(buttons).toHaveLength(4);
  for (const button of buttons) {
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("title")).toBeNull();
  }

});
