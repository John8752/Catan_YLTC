// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPoker, DEFAULT_POKER_SETTINGS, freshDeck } from "@catan/game-core/texas-holdem";
import { projectPoker, type PokerRoomView } from "@catan/protocol/texas-holdem";
import { PlayingCard } from "./PlayingCard.js";
import { PokerActions } from "./PokerActions.js";
import { PokerLobby } from "./PokerLobby.js";
afterEach(cleanup);
it("gives every card a distinct accessible rank and suit, independently of colour", () => {
  render(<>{freshDeck().map((c) => <PlayingCard key={c} card={c} />)}<PlayingCard card={null} /></>);
  const cards = screen.getAllByRole("img");
  expect(cards).toHaveLength(53); expect(new Set(cards.map((c) => c.getAttribute("aria-label"))).size).toBe(53);
  for (const suit of ["黑桃", "红桃", "方块", "梅花"]) {
    expect(screen.getByRole("img", { name: `${suit} 10` }).textContent).toContain("10");
    expect(screen.getByRole("img", { name: `${suit} A` }).querySelector("svg")).toBeTruthy();
  }
  expect(screen.getByRole("img", { name: "未公开的底牌" }).textContent).toBe("");
});
it("uses projected legality and sends a total raise amount", () => {
  const s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck()), action = vi.fn();
  const game = projectPoker(s, "a"), v = render(<PokerActions game={game} busy={false} onAction={action} />);
  expect(screen.queryByRole("button", { name: "过牌" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "加注" }));
  fireEvent.click(screen.getByRole("button", { name: "一个底池" }));
  expect((screen.getByLabelText("加注总额") as HTMLInputElement).value).toBe("60");
  fireEvent.change(screen.getByLabelText("加注总额"), { target: { value: "80" } });
  fireEvent.click(screen.getByRole("button", { name: "确认加注" })); expect(action).toHaveBeenCalledWith({ type: "raise", to: 80 });
  v.rerender(<PokerActions game={{ ...game, revision: 2, legal: { ...game.legal, minRaiseTo: null, allIn: false } }} busy={false} onAction={action} />);
  expect(screen.queryByRole("button", { name: "确认加注" })).toBeNull();
  expect((screen.getByRole("button", { name: "全下" }) as HTMLButtonElement).disabled).toBe(true);
});
it("changes modes explicitly and requires saving before starting", () => {
  const room: PokerRoomView = { id: "ROOM", gameId: "texas-holdem", matchId: null, hostPlayerId: "a", revision: 1, members: [{ id: "a", name: "甲", color: "pine", isHost: true }, { id: "b", name: "乙", color: "ocean", isHost: false }], settings: DEFAULT_POKER_SETTINGS, game: null };
  const settings = vi.fn(), start = vi.fn();
  render(<PokerLobby room={room} host busy={false} onSettings={settings} onStart={start} onShuffle={vi.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: /锦标赛/ }));
  expect(screen.getByLabelText("每几手升盲")).toBeTruthy(); expect(screen.queryByLabelText("约定手数")).toBeNull();
  expect((screen.getByRole("button", { name: "请先保存设置" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "保存设置" })); expect(settings).toHaveBeenCalledWith({ ...DEFAULT_POKER_SETTINGS, mode: "tournament" }); expect(start).not.toHaveBeenCalled();
});
