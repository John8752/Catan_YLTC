import {
  longestRoadLength,
  type AwardHolderState,
  type AwardsState,
} from "../awards/index.js";
import type { PlayerId } from "../primitives/index.js";
import type { GameCommandResult, GameEvent } from "./commands.js";
import { assertGameInvariant } from "./create-game.js";
import type { GameState } from "./state.js";

export function finalizeAcceptedTransition(result: GameCommandResult): GameCommandResult {
  if (!result.accepted) return result;
  let state = result.state;
  const events: GameEvent[] = [...result.events];
  const awards = calculateAwards(state);

  if (awards.longestRoad.holderId !== state.awards.longestRoad.holderId) {
    events.push({ type: "award_changed", award: "longest-road", holderId: awards.longestRoad.holderId });
  }
  if (awards.largestArmy.holderId !== state.awards.largestArmy.holderId) {
    events.push({ type: "award_changed", award: "largest-army", holderId: awards.largestArmy.holderId });
  }

  state = {
    ...state,
    awards,
    players: state.players.map((player) => ({
      ...player,
      visibleVictoryPoints: publicVictoryPoints(state, awards, player.id),
    })),
  };

  if (state.phase.kind === "turn") {
    const activePlayerId = state.phase.activePlayerId;
    if (actualVictoryPoints(state, activePlayerId) >= 10) {
      state = { ...state, phase: { kind: "finished", winnerId: activePlayerId } };
      events.push({ type: "game_won", playerId: activePlayerId });
    }
  }

  assertGameInvariant(state);
  return { accepted: true, state, events };
}

export function calculateAwards(state: GameState): AwardsState {
  const roadScores = new Map(
    state.players.map((player) => [
      player.id,
      longestRoadLength(state.map, state.buildings, state.roads, player.id),
    ]),
  );
  const armyScores = new Map(state.players.map((player) => [player.id, player.playedKnights]));
  return {
    longestRoad: resolveAward(state.awards.longestRoad.holderId, roadScores, 5),
    largestArmy: resolveAward(state.awards.largestArmy.holderId, armyScores, 3),
  };
}

export function actualVictoryPoints(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Unknown player ${playerId}`);
  return player.visibleVictoryPoints + player.developmentCards.filter((card) => card.type === "victory-point").length;
}

function publicVictoryPoints(state: GameState, awards: AwardsState, playerId: PlayerId): number {
  const buildingPoints = state.buildings
    .filter((building) => building.ownerId === playerId)
    .reduce((total, building) => total + (building.kind === "city" ? 2 : 1), 0);
  const awardPoints =
    (awards.longestRoad.holderId === playerId ? 2 : 0) +
    (awards.largestArmy.holderId === playerId ? 2 : 0);
  return buildingPoints + awardPoints;
}

function resolveAward(
  currentHolderId: PlayerId | null,
  scores: ReadonlyMap<PlayerId, number>,
  minimum: number,
): AwardHolderState {
  const maximum = Math.max(0, ...scores.values());
  if (maximum < minimum) return { holderId: null, value: maximum };
  const leaders = [...scores.entries()].filter(([, score]) => score === maximum).map(([playerId]) => playerId);
  if (currentHolderId !== null && leaders.includes(currentHolderId)) {
    return { holderId: currentHolderId, value: maximum };
  }
  return { holderId: leaders.length === 1 ? (leaders[0] ?? null) : null, value: maximum };
}
