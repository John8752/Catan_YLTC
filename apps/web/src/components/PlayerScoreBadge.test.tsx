// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PlayerScoreBadge } from "./PlayerScoreBadge.js";

afterEach(cleanup);
it.each([7, 8, 9])("marks public score %i with a trophy and target, not color alone", (score) => {
  const { container } = render(<PlayerScoreBadge player={{ id: "p1", name: "林", visibleVictoryPoints: score }} victoryPointsToWin={10} active />);
  expect(screen.getByText(`${score}/10`)).not.toBeNull();
  expect(container.querySelector("[data-victory-proximity]")?.getAttribute("data-victory-proximity")).toBe(String(10 - score));
  expect(container.querySelector("svg")).not.toBeNull();
  expect(screen.getByLabelText(new RegExp(`公开分数距目标 ${10 - score} 分`))).not.toBeNull();
});
it("removes emphasis after score loss or match finish and follows custom targets", () => {
  const player = { id: "p1", name: "林", visibleVictoryPoints: 9 };
  const { container, rerender } = render(<PlayerScoreBadge player={player} victoryPointsToWin={12} active />);
  expect(screen.getByText("9/12")).not.toBeNull();
  rerender(<PlayerScoreBadge player={{ ...player, visibleVictoryPoints: 8 }} victoryPointsToWin={12} active />);
  expect(container.querySelector("[data-victory-proximity]")).toBeNull();
  expect(screen.getByText("8")).not.toBeNull();
  rerender(<PlayerScoreBadge player={player} victoryPointsToWin={10} active={false} />);
  expect(container.querySelector("[data-victory-proximity]")).toBeNull();
});
