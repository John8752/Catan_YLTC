import { describe, expect, it } from "vitest";
import { createBaseGame, createStandardBoard, type PlayerSeed } from "./index.js";

const players: readonly PlayerSeed[] = [
  { id: "player_1", name: "林", color: "terracotta" },
  { id: "player_2", name: "周", color: "ocean" },
  { id: "player_3", name: "陈", color: "pine" },
];

describe("deterministic board generation", () => {
  it("creates the same board for the same seed", () => {
    expect(createStandardBoard(20260819)).toEqual(createStandardBoard(20260819));
  });

  it("creates a different terrain order for a different seed", () => {
    const first = createStandardBoard(1).map((tile) => tile.terrain);
    const second = createStandardBoard(2).map((tile) => tile.terrain);

    expect(first).not.toEqual(second);
  });

  it("creates the standard 19-hex terrain composition", () => {
    const board = createStandardBoard(42);
    const count = (terrain: string) => board.filter((tile) => tile.terrain === terrain).length;

    expect(board).toHaveLength(19);
    expect(count("lumber")).toBe(4);
    expect(count("wool")).toBe(4);
    expect(count("grain")).toBe(4);
    expect(count("brick")).toBe(3);
    expect(count("ore")).toBe(3);
    expect(count("desert")).toBe(1);
    expect(board.filter((tile) => tile.numberToken !== null)).toHaveLength(18);
  });
});

describe("base game creation", () => {
  it("starts in snake-order setup", () => {
    const game = createBaseGame({ id: "game_1", seed: 42, players });

    expect(game.phase).toEqual({
      kind: "setup",
      step: "settlement",
      placementOrder: [
        "player_1",
        "player_2",
        "player_3",
        "player_3",
        "player_2",
        "player_1",
      ],
      placementIndex: 0,
    });
  });

  it("seats two players on the standard board", () => {
    const state = createBaseGame({ id: "game_1", seed: 42, players: players.slice(0, 2) });
    expect(state.players).toHaveLength(2);
    expect(state.ruleProfile).toBe("base-3-4");
    // Two seats change nothing else: same board, same bank, same setup order.
    expect(state.map.hexes).toHaveLength(19);
    expect(state.phase.kind).toBe("setup");
  });

  it("rejects player counts the profile cannot seat", () => {
    expect(() => createBaseGame({ id: "game_1", seed: 42, players: players.slice(0, 1) })).toThrow(
      "requires 2–4 players",
    );
    expect(() => createBaseGame({ id: "game_1", seed: 42, players: [...players, ...players].slice(0, 5) })).toThrow(
      "requires 2–4 players",
    );
  });
});
