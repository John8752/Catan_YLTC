// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  // jsdom has no layout, so the log's scroll-to-newest call needs a stub.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

it("waits for the generate button instead of spending a call on open", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({ mode: "commentary", revision: 12, content: "港口已经闻到矿石的味道了。" });
  render(<AiCommentaryControl session={session} revision={12} turnNumber={4} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(requestAiCommentary).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: /生成/ }));
  expect(await screen.findByText("港口已经闻到矿石的味道了。")).toBeTruthy();
  expect(requestAiCommentary).toHaveBeenCalledWith(session, 12, "commentary");
});

it("appends each result under the last one and keeps them when the dialog is reopened", async () => {
  vi.mocked(requestAiCommentary)
    .mockResolvedValueOnce({ mode: "commentary", revision: 12, content: "第一条解说。" })
    .mockResolvedValueOnce({ mode: "prediction", revision: 12, content: "第二条解说。" });
  render(<AiCommentaryControl session={session} revision={12} turnNumber={4} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));
  expect(await screen.findByText("第一条解说。")).toBeTruthy();

  fireEvent.click(screen.getByRole("radio", { name: "预测走势" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));
  expect(await screen.findByText("第二条解说。")).toBeTruthy();
  expect(requestAiCommentary).toHaveBeenNthCalledWith(2, session, 12, "prediction");

  // Newest last, matching the public history's reading order.
  const rows = within(screen.getByRole("log")).getAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    expect.stringContaining("第一条解说。"),
    expect.stringContaining("第二条解说。"),
  ]);

  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  expect(await screen.findByText("第一条解说。")).toBeTruthy();
  expect(screen.getByText("第二条解说。")).toBeTruthy();
});

it("breaks a result into one line per sentence", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({
    mode: "summary",
    revision: 12,
    content: "林手里没砖。周已经修到第三条路了！陈还在等六点吗？",
  });
  render(<AiCommentaryControl session={session} revision={12} turnNumber={4} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));

  expect(await screen.findByText("林手里没砖。")).toBeTruthy();
  expect(screen.getByText("周已经修到第三条路了！")).toBeTruthy();
  expect(screen.getByText("陈还在等六点吗？")).toBeTruthy();
});

it("marks only the entries the board has moved past", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({ mode: "commentary", revision: 12, content: "刚才还是这个局面。" });
  const view = render(<AiCommentaryControl session={session} revision={12} turnNumber={4} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));
  expect(await screen.findByText("刚才还是这个局面。")).toBeTruthy();
  expect(screen.queryByText("棋局已推进，这段基于较早的局势")).toBeNull();

  view.rerender(<AiCommentaryControl session={session} revision={13} turnNumber={4} setupAnalysis={null} players={players} />);
  expect(screen.getByText("棋局已推进，这段基于较早的局势")).toBeTruthy();
});

it("flags the finished setup read on the button instead of opening over the board", async () => {
  const view = render(<AiCommentaryControl
    session={session}
    revision={12}
    turnNumber={4}
    players={players}
    setupAnalysis={{ status: "loading", sourceRevision: 12 }}
  />);

  view.rerender(<AiCommentaryControl
    session={session}
    revision={13}
    turnNumber={4}
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

  // Nothing steals the screen: the board is still there for whoever is mid-turn.
  expect(screen.queryByRole("dialog")).toBeNull();
  const trigger = await screen.findByRole("button", { name: "AI 解说，开局点评已就绪" });

  fireEvent.click(trigger);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(screen.getByText("点数扎实，资源面也很均衡。")).toBeTruthy();
  expect(screen.getByText("港口路线清晰，但前期需要耐心。")).toBeTruthy();
  expect(screen.getByText("娱乐性胜者预测 · 周")).toBeTruthy();
  expect(requestAiCommentary).not.toHaveBeenCalled();
  // Reading it clears the flag. Checked after closing, because an open dialog
  // hides the rest of the page from the accessibility tree.
  fireEvent.keyDown(document, { key: "Escape" });
  expect(await screen.findByRole("button", { name: "AI 解说" })).toBeTruthy();
});

it("reads the table's intent per player and sends a target to the board", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({
    mode: "intent",
    revision: 12,
    content: "两个人都在盯同一片麦地。",
    intent: {
      overview: "两个人都在盯同一片麦地。",
      players: [
        { playerId: "player_1", targetVertexId: "V12", roadsNeeded: 2, intent: "想把路修到那块 8 点麦地。", blocker: "手上没有砖的产出。" },
        { playerId: "player_2", targetVertexId: null, roadsNeeded: null, intent: "更像是在攒发展卡。", blocker: "村庄棋子快用完了。" },
      ],
    },
  });
  const onFocusVertex = vi.fn();
  render(<AiCommentaryControl
    session={session}
    revision={12}
    turnNumber={4}
    setupAnalysis={null}
    players={players}
    onFocusVertex={onFocusVertex}
  />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  fireEvent.click(screen.getByRole("radio", { name: "大家在惦记什么" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));

  expect(await screen.findByText("想把路修到那块 8 点麦地。")).toBeTruthy();
  expect(screen.getByText("卡点 · 手上没有砖的产出。")).toBeTruthy();
  expect(screen.getByText("更像是在攒发展卡。")).toBeTruthy();
  // Only the seat with a server-offered site gets something to point at.
  expect(screen.getAllByRole("button", { name: /还差 2 条路/ })).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: /还差 2 条路/ }));
  expect(onFocusVertex).toHaveBeenCalledWith("V12");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("spends the intent read once per turn and opens it again on the next one", async () => {
  vi.mocked(requestAiCommentary).mockResolvedValue({
    mode: "intent",
    revision: 12,
    content: "看完了。",
    intent: { overview: "看完了。", players: [] },
  });
  const view = render(<AiCommentaryControl session={session} revision={12} turnNumber={4} setupAnalysis={null} players={players} />);

  fireEvent.click(screen.getByRole("button", { name: "AI 解说" }));
  fireEvent.click(screen.getByRole("radio", { name: "大家在惦记什么" }));
  fireEvent.click(screen.getByRole("button", { name: /生成/ }));
  expect(await screen.findByText("看完了。")).toBeTruthy();

  expect(screen.getByRole("radio", { name: "大家在惦记什么" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("「大家在惦记什么」每回合只看一次，下个回合再来。")).toBeTruthy();

  view.rerender(<AiCommentaryControl session={session} revision={13} turnNumber={5} setupAnalysis={null} players={players} />);
  expect(screen.getByRole("radio", { name: "大家在惦记什么" }).hasAttribute("disabled")).toBe(false);
});
