// @vitest-environment jsdom

import { createBaseGame } from "@catan/game-core";
import { projectGameForPlayer, type RoomView } from "@catan/protocol";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableUtilities } from "./TableUtilities.js";

afterEach(() => cleanup());

describe("TableUtilities", () => {
  it("keeps the complete rules reference beside the turn forecast", () => {
    render(<TableUtilities room={startedRoom()} playerId="player_2" busy={false} onDisband={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "规则速查" }));
    const guide = screen.getByRole("dialog", { name: "规则速查" });
    expect(within(guide).getByText("砖+木")).toBeTruthy();
    expect(within(guide).getByText(/发展卡 · 共 25 张/)).toBeTruthy();
    expect(within(guide).getByText(/移动强盗，从被压住的一位手上抽 1 张/)).toBeTruthy();
  });

  it("shows the relocated disband control only to the host", () => {
    const onDisband = vi.fn();
    const host = render(<TableUtilities room={startedRoom()} playerId="player_1" busy={false} onDisband={onDisband} />);

    fireEvent.click(screen.getByRole("button", { name: "解散房间" }));
    expect(screen.getByRole("dialog", { name: "确认解散房间？" }).textContent).toContain("进行中的这局会立即结束且无法恢复");
    const disbandButtons = screen.getAllByRole("button", { name: "解散房间" });
    fireEvent.click(disbandButtons[disbandButtons.length - 1]!);
    expect(onDisband).toHaveBeenCalledOnce();
    host.unmount();

    render(<TableUtilities room={startedRoom()} playerId="player_2" busy={false} onDisband={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "解散房间" })).toBeNull();
  });
});

function startedRoom(): RoomView {
  const players = [
    { id: "player_1", name: "林", color: "terracotta" as const },
    { id: "player_2", name: "周", color: "ocean" as const },
  ];
  const game = createBaseGame({ id: "table_utilities", seed: 42, players });
  return {
    id: "ABC123",
    revision: 1,
    hostPlayerId: "player_1",
    members: players.map((player, index) => ({ ...player, isHost: index === 0 })),
    settings: {
      ruleProfile: "base-3-4",
      playerLimit: 4,
      victoryPointsToWin: 10,
      mapSeed: 42,
      bankCountsPublic: true,
    },
    previewMap: null,
    game: projectGameForPlayer(game, "player_1"),
    setupAnalysis: null,
  };
}
