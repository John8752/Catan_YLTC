// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { requestAiCommentary, type PlayerSession } from "@/api.js";
import { AiCommentaryControl } from "./AiCommentaryControl.js";

vi.mock("@/api.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/api.js")>();
  return { ...original, requestAiCommentary: vi.fn() };
});

const session: PlayerSession = { roomId: "A1B2C3", playerId: "player_1", seatToken: "seat_1" };
const players = [
  { id: "player_1", name: "林", color: "terracotta" as const, isHost: true },
  { id: "player_2", name: "周", color: "ocean" as const, isHost: false },
];

beforeEach(() => {
  vi.mocked(requestAiCommentary).mockReset();
});

afterEach(() => cleanup());

it("generates a commentary on the first click and lets the player switch modes", async () => {
  vi.mocked(requestAiCommentary)
    .mockResolvedValueOnce({ mode: "commentary", revision: 12, content: "港口已经闻到矿石的味道了。" })
    .mockResolvedValueOnce({ mode: "prediction", revision: 12, content: "下一轮大概率会围绕最长道路较劲。" });
  render(<AiCommentaryControl session={session} revision={12} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  expect(await screen.findByText("港口已经闻到矿石的味道了。")).toBeTruthy();
  expect(requestAiCommentary).toHaveBeenNthCalledWith(1, session, 12, "commentary");

  fireEvent.click(screen.getByRole("button", { name: "预测走势" }));
  expect(await screen.findByText("下一轮大概率会围绕最长道路较劲。")).toBeTruthy();
  expect(requestAiCommentary).toHaveBeenNthCalledWith(2, session, 12, "prediction");
});

it("marks a completed result when the board has moved on", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({ mode: "commentary", revision: 12, content: "刚才还是这个局面。" });
  const view = render(<AiCommentaryControl session={session} revision={12} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  expect(await screen.findByText("刚才还是这个局面。")).toBeTruthy();
  view.rerender(<AiCommentaryControl session={session} revision={13} setupAnalysis={null} players={players} />);

  expect(screen.getByText("棋局已经继续推进，这段解说基于较早的局势。")).toBeTruthy();
});

it("automatically opens one public comment per player when setup analysis finishes", async () => {
  const view = render(<AiCommentaryControl
    session={session}
    revision={12}
    players={players}
    setupAnalysis={{ status: "loading", sourceRevision: 12 }}
  />);

  view.rerender(<AiCommentaryControl
    session={session}
    revision={13}
    players={players}
    setupAnalysis={{
      status: "ready",
      sourceRevision: 12,
      playerComments: [
        { playerId: "player_1", comment: "点数扎实，资源面也很均衡。" },
        { playerId: "player_2", comment: "港口路线清晰，但前期需要耐心。" },
      ],
      predictedWinnerId: "player_2",
      prediction: "周的港口组合更有后劲，不过这只是公开选点上的娱乐预测。",
    }}
  />);

  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(screen.getByText("点数扎实，资源面也很均衡。")).toBeTruthy();
  expect(screen.getByText("港口路线清晰，但前期需要耐心。")).toBeTruthy();
  expect(screen.getByText("娱乐性胜者预测 · 周")).toBeTruthy();
  expect(requestAiCommentary).not.toHaveBeenCalled();
});
