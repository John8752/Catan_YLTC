import { createStandardBoard } from "./board.js";
import {
  emptyResourceHand,
  type GameState,
  type PlayerSeed,
  type TerrainType,
} from "./model.js";

const EXPECTED_TERRAIN_COUNTS: Readonly<Record<TerrainType, number>> = {
  brick: 3,
  lumber: 4,
  wool: 4,
  grain: 4,
  ore: 3,
  desert: 1,
};

export interface CreateGameInput {
  readonly id: string;
  readonly seed: number;
  readonly players: readonly PlayerSeed[];
}

export class GameRuleError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_PLAYER_COUNT" | "DUPLICATE_PLAYER" | "INVALID_PLAYER_NAME",
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}

export function createBaseGame(input: CreateGameInput): GameState {
  if (input.players.length < 3 || input.players.length > 4) {
    throw new GameRuleError(
      "UNSUPPORTED_PLAYER_COUNT",
      "The base-3-4 rule profile requires three or four players",
    );
  }

  const ids = new Set<string>();

  for (const player of input.players) {
    if (player.name.trim().length === 0) {
      throw new GameRuleError("INVALID_PLAYER_NAME", "Player names cannot be empty");
    }

    if (ids.has(player.id)) {
      throw new GameRuleError("DUPLICATE_PLAYER", `Duplicate player id: ${player.id}`);
    }

    ids.add(player.id);
  }

  const placementOrder = [
    ...input.players.map((player) => player.id),
    ...input.players.map((player) => player.id).reverse(),
  ];

  const state: GameState = {
    id: input.id,
    ruleProfile: "base-3-4",
    seed: input.seed,
    revision: 1,
    board: createStandardBoard(input.seed),
    players: input.players.map((player) => ({
      ...player,
      resources: emptyResourceHand(),
      visibleVictoryPoints: 0,
    })),
    phase: {
      kind: "setup",
      placementOrder,
      placementIndex: 0,
    },
  };

  assertGameInvariant(state);
  return state;
}

export function assertGameInvariant(state: GameState): void {
  if (state.board.length !== 19) {
    throw new Error(`Expected 19 board hexes, received ${state.board.length}`);
  }

  const coordinateKeys = new Set(state.board.map((tile) => `${tile.q},${tile.r}`));

  if (coordinateKeys.size !== state.board.length) {
    throw new Error("Board coordinates must be unique");
  }

  for (const [terrain, expectedCount] of Object.entries(EXPECTED_TERRAIN_COUNTS)) {
    const actualCount = state.board.filter((tile) => tile.terrain === terrain).length;

    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} ${terrain} tiles, received ${actualCount}`);
    }
  }

  const playerIds = new Set(state.players.map((player) => player.id));

  if (playerIds.size !== state.players.length) {
    throw new Error("Player ids must be unique");
  }
}
