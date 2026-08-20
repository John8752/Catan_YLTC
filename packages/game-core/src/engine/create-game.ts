import { initialPieceSupply } from "../buildables/index.js";
import { emptyResourceHand, RESOURCE_TYPES } from "../resources/index.js";
import {
  DEFAULT_VICTORY_POINTS_TO_WIN,
  getRuleProfileDefinition,
  MAX_VICTORY_POINTS_TO_WIN,
  MIN_VICTORY_POINTS_TO_WIN,
  type PlayableRuleProfile,
} from "../rulesets/index.js";
import type { GameState, PlayerSeed } from "./state.js";

export interface CreateGameInput {
  readonly id: string;
  readonly seed: number;
  readonly players: readonly PlayerSeed[];
  readonly victoryPointsToWin?: number;
  readonly ruleProfile?: PlayableRuleProfile;
}

export class GameRuleError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_PLAYER_COUNT" | "DUPLICATE_PLAYER" | "INVALID_PLAYER_NAME" | "INVALID_VICTORY_TARGET",
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}

export function createBaseGame(input: CreateGameInput): GameState {
  return createGame({ ...input, ruleProfile: "base-3-4" });
}

export function createGame(input: CreateGameInput): GameState {
  const ruleProfile = input.ruleProfile ?? "base-3-4";
  const profile = getRuleProfileDefinition(ruleProfile);
  if (input.players.length < profile.minPlayers || input.players.length > profile.maxPlayers) {
    throw new GameRuleError(
      "UNSUPPORTED_PLAYER_COUNT",
      ruleProfile === "base-3-4"
        ? "The base-3-4 rule profile requires three or four players"
        : `The ${ruleProfile} rule profile requires ${profile.minPlayers}–${profile.maxPlayers} players`,
    );
  }

  const victoryPointsToWin = input.victoryPointsToWin ?? DEFAULT_VICTORY_POINTS_TO_WIN;
  if (
    !Number.isInteger(victoryPointsToWin) ||
    victoryPointsToWin < MIN_VICTORY_POINTS_TO_WIN ||
    victoryPointsToWin > MAX_VICTORY_POINTS_TO_WIN
  ) {
    throw new GameRuleError(
      "INVALID_VICTORY_TARGET",
      `Victory target must be ${MIN_VICTORY_POINTS_TO_WIN}–${MAX_VICTORY_POINTS_TO_WIN} points`,
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
    ruleProfile,
    victoryPointsToWin,
    seed: input.seed,
    revision: 1,
    map: profile.createMap(input.seed),
    bank: profile.createBank(),
    buildings: [],
    roads: [],
    players: input.players.map((player) => ({
      ...player,
      resources: emptyResourceHand(),
      pieces: initialPieceSupply(),
      visibleVictoryPoints: 0,
      developmentCards: [],
      playedKnights: 0,
    })),
    phase: {
      kind: "setup",
      step: "settlement",
      placementOrder,
      placementIndex: 0,
    },
    lastRoll: null,
    pendingDiscards: [],
    openTrade: null,
    developmentDeck: profile.createDevelopmentDeck(input.seed),
    developmentCardPlayedThisTurn: false,
    robberResumeStep: null,
    freeRoadsRemaining: 0,
    developmentResumeStep: null,
    awards: emptyAwards(),
  };

  assertGameInvariant(state);
  return state;
}

export function assertGameInvariant(state: GameState): void {
  if (
    !Number.isInteger(state.victoryPointsToWin) ||
    state.victoryPointsToWin < MIN_VICTORY_POINTS_TO_WIN ||
    state.victoryPointsToWin > MAX_VICTORY_POINTS_TO_WIN
  ) {
    throw new Error(`Invalid victory target: ${state.victoryPointsToWin}`);
  }

  if (state.ruleProfile === "two-player") throw new Error("The two-player profile is not playable");
  const profile = getRuleProfileDefinition(state.ruleProfile);
  const expectedHexCount = Object.values(profile.terrainCounts).reduce((total, count) => total + count, 0);
  if (state.map.hexes.length !== expectedHexCount) {
    throw new Error(`Expected ${expectedHexCount} board hexes, received ${state.map.hexes.length}`);
  }

  const coordinateKeys = new Set(state.map.hexes.map((tile) => `${tile.q},${tile.r}`));

  if (coordinateKeys.size !== state.map.hexes.length) {
    throw new Error("Board coordinates must be unique");
  }

  for (const [terrain, expectedCount] of Object.entries(profile.terrainCounts)) {
    const actualCount = state.map.hexes.filter((tile) => tile.terrain === terrain).length;

    if (actualCount !== expectedCount) {
      throw new Error(`Expected ${expectedCount} ${terrain} tiles, received ${actualCount}`);
    }
  }

  const playerIds = new Set(state.players.map((player) => player.id));

  if (playerIds.size !== state.players.length) {
    throw new Error("Player ids must be unique");
  }

  for (const resource of RESOURCE_TYPES) {
    if (state.bank[resource] < 0) throw new Error(`Bank ${resource} cannot be negative`);
    for (const player of state.players) {
      if (player.resources[resource] < 0) {
        throw new Error(`Player ${player.id} ${resource} cannot be negative`);
      }
    }
  }

  if (new Set(state.buildings.map((building) => building.vertexId)).size !== state.buildings.length) {
    throw new Error("A vertex cannot contain multiple buildings");
  }

  if (new Set(state.roads.map((road) => road.edgeId)).size !== state.roads.length) {
    throw new Error("An edge cannot contain multiple roads");
  }

  if (state.openTrade !== null) {
    if (!playerIds.has(state.openTrade.proposerId)) throw new Error("Trade proposer must be a player");
    const responders = state.openTrade.responses.map((response) => response.playerId);
    if (new Set(responders).size !== responders.length) throw new Error("Trade responses must be unique per player");
    if (responders.some((playerId) => !playerIds.has(playerId) || playerId === state.openTrade?.proposerId)) {
      throw new Error("Trade responders must be other players");
    }
  }
}
import { emptyAwards } from "../awards/index.js";
