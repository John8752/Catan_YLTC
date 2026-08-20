import type { GameMap } from "../map/index.js";
import type { GameId, PlayerId } from "../primitives/index.js";
import type { ResourceHand } from "../resources/index.js";
import type { RuleProfile } from "../rulesets/index.js";

export const PLAYER_COLORS = [
  "terracotta",
  "ocean",
  "pine",
  "wheat",
  "plum",
  "charcoal",
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

export interface PlayerSeed {
  readonly id: PlayerId;
  readonly name: string;
  readonly color: PlayerColor;
}

export interface PlayerState extends PlayerSeed {
  readonly resources: ResourceHand;
  readonly visibleVictoryPoints: number;
}

export type GamePhase =
  | {
      readonly kind: "setup";
      readonly placementOrder: readonly PlayerId[];
      readonly placementIndex: number;
    }
  | {
      readonly kind: "turn";
      readonly activePlayerId: PlayerId;
      readonly step: "roll" | "resolve-seven" | "trade-build";
      readonly turnNumber: number;
    }
  | {
      readonly kind: "finished";
      readonly winnerId: PlayerId;
    };

export interface GameState {
  readonly id: GameId;
  readonly ruleProfile: RuleProfile;
  readonly seed: number;
  readonly revision: number;
  readonly map: GameMap;
  readonly players: readonly PlayerState[];
  readonly phase: GamePhase;
}
