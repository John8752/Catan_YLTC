// @vitest-environment jsdom

import { createBaseGame, createGame } from "@catan/game-core";
import type { GameView } from "@catan/protocol";
import { projectGameForPlayer } from "@catan/protocol";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
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

it("names what the resource pickers are choosing", () => {
  render(<DevelopmentControls game={handView()} busy={false} onCommand={() => {}} />);

  expect(screen.getByRole("combobox", { name: "垄断要抢的资源" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "丰收的第一张资源" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "丰收的第二张资源" })).toBeTruthy();
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

  // The victory point card never gets a button; the other four do.
  const buttons = screen.getAllByRole("button", { name: "使用" });
  expect(buttons).toHaveLength(4);
  for (const button of buttons) {
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(button.getAttribute("title")).toBeNull();
  }
});
