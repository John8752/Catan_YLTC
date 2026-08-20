import type { BuildingState, PieceSupply, RoadState } from "../buildables/index.js";
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
  readonly pieces: PieceSupply;
  readonly visibleVictoryPoints: number;
}

export type GamePhase =
  | {
      readonly kind: "setup";
      readonly step: "settlement";
      readonly placementOrder: readonly PlayerId[];
      readonly placementIndex: number;
    }
  | {
      readonly kind: "setup";
      readonly step: "road";
      readonly placementOrder: readonly PlayerId[];
      readonly placementIndex: number;
      readonly settlementVertexId: string;
    }
  | {
      readonly kind: "turn";
      readonly activePlayerId: PlayerId;
      readonly step: "roll" | "resolve-seven" | "action";
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
  readonly bank: ResourceHand;
  readonly buildings: readonly BuildingState[];
  readonly roads: readonly RoadState[];
  readonly players: readonly PlayerState[];
  readonly phase: GamePhase;
  readonly lastRoll: readonly [number, number] | null;
}
