// @vitest-environment jsdom

import { createBaseGame, createStandardMap } from "@catan/game-core";
import { projectGameForPlayer, type RoomView } from "@catan/protocol";
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
    expect(screen.getByText(/地图 #77/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "出发吧，开拓者们" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "地图产能分析" })).toBeTruthy();
    expect(hostView.container.querySelectorAll("[data-resource-analysis]")).toHaveLength(5);
    expect(screen.getByText(/全图最稀缺/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "再次随机" }));
    expect(onReroll).toHaveBeenCalledOnce();
    hostView.unmount();

    render(<LobbySetup room={room} isHost={false} busy={false} onReroll={onReroll} />);
    expect(screen.queryByRole("button", { name: "再次随机" })).toBeNull();
    expect(screen.getByText("等待房主确认")).toBeTruthy();
  });

  it("exposes table size and victory target controls to the host", () => {
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
        onLeave={onLeave} onDisband={vi.fn()}
      />,
    );

    // One control, not two: the profile is the choice, and the seat cap follows it.
    expect(screen.queryByRole("button", { name: "3 人" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "获胜分数" }), { target: { value: "12" } });
    expect(onSettingsChange).toHaveBeenCalledWith({ ruleProfile: "base-3-4", victoryPointsToWin: 12, bankCountsPublic: true });
    fireEvent.click(screen.getByRole("button", { name: "最多 6 人" }));
    expect(onSettingsChange).toHaveBeenCalledWith({ ruleProfile: "extended-5-6", victoryPointsToWin: 10, bankCountsPublic: true });
    fireEvent.change(screen.getByRole("combobox", { name: "银行剩余数量" }), { target: { value: "hidden" } });
    expect(onSettingsChange).toHaveBeenCalledWith({ ruleProfile: "base-3-4", victoryPointsToWin: 10, bankCountsPublic: false });

    fireEvent.click(screen.getByRole("button", { name: "离开房间" }));
    expect(screen.getByRole("dialog", { name: "确认离开房间？" }).textContent).toContain("房主将自动转交给 周");
    fireEvent.click(screen.getByRole("button", { name: "确认离开" }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("does not duplicate the relocated disband control in the running-room panel", () => {
    const base = createBaseGame({ id: "disband", seed: 42, players: [
      { id: "player_1", name: "林", color: "terracotta" },
      { id: "player_2", name: "周", color: "ocean" },
    ] });
    const started = { ...lobbyRoom(), game: projectGameForPlayer(base, "player_1"), previewMap: null };
    const view = render(
      <RoomPanel
        room={started}
        playerId="player_1"
        connectionState="live"
        busy={false}
        onStart={vi.fn()}
        onSettingsChange={vi.fn()}
        onLeave={vi.fn()}
        onDisband={vi.fn()}
      />,
    );

    // Both exits leave this panel once play starts. The host-only disband action
    // is mounted beside the turn forecast by TableUtilities.
    expect(screen.queryByRole("button", { name: "离开房间" })).toBeNull();
    expect(screen.queryByRole("button", { name: "解散房间" })).toBeNull();
    view.unmount();

    render(
      <RoomPanel
        room={started}
        playerId="player_2"
        connectionState="live"
        busy={false}
        onStart={vi.fn()}
        onSettingsChange={vi.fn()}
        onLeave={vi.fn()}
        onDisband={vi.fn()}
      />,
    );
    expect(screen.queryAllByRole("button", { name: "解散房间" })).toHaveLength(0);
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
        onDisband={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "最多 4 人" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "获胜分数" }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "银行剩余数量" }) as HTMLSelectElement).disabled).toBe(true);
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
      bankCountsPublic: true,
    },
    previewMap: createStandardMap(77),
    game: null,
    setupAnalysis: null,
  };
}
