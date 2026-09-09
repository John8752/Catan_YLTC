// @vitest-environment jsdom
import { createBaseGame, type GameState } from "@catan/game-core";
import { projectGameForPlayer, type GameView } from "@catan/protocol";
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGameSounds } from "./use-game-sounds.js";

const audio = vi.hoisted(() => ({ play: vi.fn(), unlock: vi.fn(), setMuted: vi.fn(), dispose: vi.fn() }));
vi.mock("./game-audio.js", () => ({ createGameAudio: () => audio }));
const base = createBaseGame({ id: "audio", seed: 42, players: [
  { id: "p1", name: "甲", color: "terracotta" }, { id: "p2", name: "乙", color: "ocean" },
] });
const view = (revision: number, step: Extract<GameState["phase"], { kind: "turn" }>["step"], player = "p1", turnNumber = 1, roll = false) => projectGameForPlayer({
  ...base, revision, phase: { kind: "turn", activePlayerId: player, step, turnNumber },
}, "p1", roll ? [{ revision, event: { type: "dice_rolled", playerId: player, dice: [3, 4] } }] : []);
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it("plays distinct cues once, without a second turn cue after rolling or mandatory resolutions", () => {
  const { rerender } = renderHook(({ game }) => useGameSounds(game, 1, true), { initialProps: { game: view(1, "action", "p2") } });
  expect(audio.play).not.toHaveBeenCalled();
  rerender({ game: view(2, "roll") });
  rerender({ game: view(2, "roll") });
  rerender({ game: view(3, "action", "p1", 1, true) });
  rerender({ game: view(3, "action", "p1", 1, true) });
  rerender({ game: view(4, "robber") });
  rerender({ game: view(5, "action") });
  expect(audio.play.mock.calls).toEqual([["your-turn"], ["dice-roll"]]);
  rerender({ game: view(6, "action", "p2", 2, true) });
  expect(audio.play.mock.calls.at(-1)).toEqual(["dice-roll"]);
});

it("suppresses initial, disconnected, reconnect and stale snapshots, then accepts new live turns", () => {
  const { rerender } = renderHook(({ game, epoch, live }) => useGameSounds(game, epoch, live), {
    initialProps: { game: view(1, "action", "p1", 1, true), epoch: 1, live: true },
  });
  rerender({ game: view(2, "roll", "p1", 2), epoch: 1, live: false });
  rerender({ game: view(3, "action", "p1", 2, true), epoch: 2, live: true });
  rerender({ game: view(1, "action", "p1", 1, true), epoch: 2, live: true });
  rerender({ game: view(4, "action", "p1", 2), epoch: 2, live: true });
  expect(audio.play).not.toHaveBeenCalled();
  rerender({ game: view(5, "roll", "p1", 3), epoch: 2, live: true });
  expect(audio.play.mock.calls).toEqual([["your-turn"]]);
});

it("chimes once per setup opportunity and for paired actions, with quiet seat-change baselines", () => {
  const initial = projectGameForPlayer(base, "p2");
  const { rerender } = renderHook(({ game }: { game: GameView }) => useGameSounds(game, 1, true), { initialProps: { game: initial } });
  const setup = projectGameForPlayer({ ...base, revision: 2 }, "p1");
  // Seat changes establish a quiet baseline.
  rerender({ game: setup });
  if (base.phase.kind !== "setup") throw new Error("Expected setup");
  rerender({ game: projectGameForPlayer({ ...base, revision: 3, phase: { ...base.phase, placementIndex: 3 } }, "p1") });
  rerender({ game: view(4, "paired-action") });
  expect(audio.play.mock.calls).toEqual([["your-turn"], ["your-turn"]]);
});

it("unlocks during gestures, remembers mute, and cleans up listeners on unmount", () => {
  localStorage.setItem("catan-yltc-sound", "off");
  const { result, unmount } = renderHook(() => useGameSounds(null, 0, false));
  expect(result.current.enabled).toBe(false);
  expect(audio.setMuted).toHaveBeenLastCalledWith(true);
  act(() => result.current.toggle());
  expect(localStorage.getItem("catan-yltc-sound")).toBe("on");
  fireEvent.pointerUp(document);
  fireEvent.keyDown(document, { key: "Enter" });
  expect(audio.unlock).toHaveBeenCalledTimes(3);
  unmount();
  fireEvent.pointerUp(document);
  expect(audio.unlock).toHaveBeenCalledTimes(3);
  expect(audio.dispose).toHaveBeenCalledOnce();
});
