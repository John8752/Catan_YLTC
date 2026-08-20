// @vitest-environment jsdom

import { createStandardMap } from "@catan/game-core";
import type { RoomView } from "@catan/protocol";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LobbySetup } from "./LobbySetup.js";
import { RoomPanel } from "./RoomPanel.js";

afterEach(() => cleanup());

describe("lobby setup", () => {
  it("renders the server-provided map preview and lets only the host reroll it", () => {
    const room = lobbyRoom();
    const onReroll = vi.fn();
    const hostView = render(<LobbySetup room={room} isHost busy={false} onReroll={onReroll} />);

    expect(hostView.container.querySelectorAll("[data-hex-id]")).toHaveLength(19);
    expect(hostView.container.querySelectorAll("[data-port-id]")).toHaveLength(9);
    expect(screen.getByText(/种子 77/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再次随机" }));
    expect(onReroll).toHaveBeenCalledOnce();
    hostView.unmount();

    render(<LobbySetup room={room} isHost={false} busy={false} onReroll={onReroll} />);
    expect(screen.queryByRole("button", { name: "再次随机" })).toBeNull();
    expect(screen.getByText("等待房主确认")).toBeTruthy();
  });

  it("exposes player limit and victory target controls to the host", () => {
    const room = lobbyRoom();
    const onSettingsChange = vi.fn();
    const onLeave = vi.fn();
    render(
      <RoomPanel
        room={room}
        playerId="player_1"
        connectionState="live"
        busy={false}
        onStart={vi.fn()}
        onSettingsChange={onSettingsChange}
        onLeave={onLeave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "3 人" }));
    expect(onSettingsChange).toHaveBeenCalledWith({ playerLimit: 3, victoryPointsToWin: 10 });

    fireEvent.change(screen.getByRole("combobox", { name: "获胜分数" }), { target: { value: "12" } });
    expect(onSettingsChange).toHaveBeenCalledWith({ playerLimit: 4, victoryPointsToWin: 12 });
    expect(screen.getByText("基础版 3–4 人")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "离开房间" }));
    expect(screen.getByRole("dialog", { name: "确认离开房间？" }).textContent).toContain("房主将自动转交给 周");
    fireEvent.click(screen.getByRole("button", { name: "确认离开" }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("shows settings to guests without allowing them to edit", () => {
    render(
      <RoomPanel
        room={lobbyRoom()}
        playerId="player_2"
        connectionState="live"
        busy={false}
        onStart={vi.fn()}
        onSettingsChange={vi.fn()}
        onLeave={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "3 人" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "获胜分数" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText("由房主设置")).toBeTruthy();
  });
});

function lobbyRoom(): RoomView {
  return {
    id: "ABC123",
    revision: 1,
    hostPlayerId: "player_1",
    members: [
      { id: "player_1", name: "林", color: "terracotta", isHost: true },
      { id: "player_2", name: "周", color: "ocean", isHost: false },
    ],
    settings: {
      ruleProfile: "base-3-4",
      playerLimit: 4,
      victoryPointsToWin: 10,
      mapSeed: 77,
    },
    previewMap: createStandardMap(77),
    game: null,
  };
}
