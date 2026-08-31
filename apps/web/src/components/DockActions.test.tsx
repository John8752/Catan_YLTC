// @vitest-environment jsdom
import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer } from "@catan/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DockActions } from "./DockActions.js";

afterEach(cleanup);
const base = createBaseGame({ id: "disclosure", seed: 42, players: [
  { id: "p1", name: "自己", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" }, { id: "p3", name: "丙", color: "pine" },
] });
function view(step: "roll" | "action" | "discard", playerId = "p1", turnNumber = 1) {
  const state: GameState = { ...base, phase: { kind: "turn", activePlayerId: playerId, step, turnNumber }, pendingDiscards: step === "discard" ? [{ playerId: "p1", count: 2 }] : [] };
  return projectGameForPlayer(state, "p1");
}
const details = <button>执行操作</button>;

it("collapses optional actions on compact screens and returns space after selecting a build", () => {
  const game = view("action");
  const { rerender } = render(<DockActions game={game} compact buildMode={null} selectedRobberHexId={null}>{details}</DockActions>);
  expect(screen.queryByRole("button", { name: "执行操作" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "展开本回合操作" }));
  expect(screen.getByRole("button", { name: "执行操作" })).toBeTruthy();
  rerender(<DockActions game={game} compact buildMode="road" selectedRobberHexId={null}>{details}</DockActions>);
  expect(screen.queryByRole("button", { name: "执行操作" })).toBeNull();
  expect(screen.getByText("请在地图选择道路位置")).toBeTruthy();
});

it.each(["roll", "discard"] as const)("keeps %s resolution immediately available even when compact", (step) => {
  render(<DockActions game={view(step)} compact buildMode={null} selectedRobberHexId={null}>{details}</DockActions>);
  expect(screen.getByRole("button", { name: "执行操作" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "展开本回合操作" })).toBeNull();
});

it("resets expanded details between turns and shows desktop controls without disclosure", () => {
  const renderActions = (game: ReturnType<typeof view>, compact = true) => <DockActions game={game} compact={compact} buildMode={null} selectedRobberHexId={null}>{details}</DockActions>;
  const { rerender } = render(renderActions(view("action")));
  fireEvent.click(screen.getByRole("button", { name: "展开本回合操作" }));
  rerender(renderActions(view("action", "p2", 2)));
  expect(screen.queryByRole("button", { name: "执行操作" })).toBeNull();
  rerender(renderActions(view("action", "p2", 2), false));
  expect(screen.getByRole("button", { name: "执行操作" })).toBeTruthy();
});
