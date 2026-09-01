import type { PlayerId } from "../primitives/index.js";
import { getRuleProfileDefinition } from "../rulesets/index.js";
import type { GameState } from "./state.js";

export type TurnOpportunityKind = "primary" | "paired";

export interface TurnOpportunity {
  readonly playerId: PlayerId;
  readonly kind: TurnOpportunityKind;
  readonly turnNumber: number;
}

/**
 * Projects future player action opportunities from the authoritative turn
 * policy. Mandatory steps stay part of their owning primary or paired action.
 */
export function turnOpportunityQueue(
  state: GameState,
  limit = state.players.length + 1,
): readonly TurnOpportunity[] {
  if (state.phase.kind !== "turn" || limit <= 0 || state.ruleProfile === "two-player") return [];

  const phase = state.phase;
  const profile = getRuleProfileDefinition(state.ruleProfile);
  const activeIndex = state.players.findIndex((player) => player.id === phase.activePlayerId);
  if (activeIndex < 0) throw new Error(`Unknown active player ${phase.activePlayerId}`);

  const paired = profile.pairedPlayerTurns
    && phase.primaryPlayerId !== undefined
    && phase.primaryPlayerId !== phase.activePlayerId;
  let primaryIndex = paired
    ? state.players.findIndex((player) => player.id === phase.primaryPlayerId)
    : activeIndex;
  if (primaryIndex < 0) throw new Error(`Unknown primary player ${phase.primaryPlayerId}`);

  let playerIndex = activeIndex;
  let kind: TurnOpportunityKind = paired ? "paired" : "primary";
  let turnNumber = phase.turnNumber;
  const queue: TurnOpportunity[] = [];

  while (queue.length < limit) {
    const player = state.players[playerIndex];
    if (player === undefined) throw new Error(`Missing player at turn index ${playerIndex}`);
    queue.push({ playerId: player.id, kind, turnNumber });

    if (profile.pairedPlayerTurns && kind === "primary") {
      playerIndex = (primaryIndex + 3) % state.players.length;
      kind = "paired";
      continue;
    }

    primaryIndex = (primaryIndex + 1) % state.players.length;
    playerIndex = primaryIndex;
    kind = "primary";
    turnNumber += 1;
  }

  return queue;
}
