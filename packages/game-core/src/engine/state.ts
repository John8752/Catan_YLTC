import type { BuildingState, PieceSupply, RoadState } from "../buildables/index.js";
import type { DevelopmentCardState, DevelopmentCardType } from "../development/index.js";
import type { GameMap } from "../map/index.js";
import type { GameId, PlayerId } from "../primitives/index.js";
import type { ResourceHand } from "../resources/index.js";
import type { RuleProfile } from "../rulesets/index.js";
import type { TradeOfferState } from "../trade/index.js";
import type { BalancedDiceBagState } from "./dice-bag.js";

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
  readonly developmentCards: readonly DevelopmentCardState[];
  readonly playedKnights: number;
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
      readonly step: "roll" | "discard" | "robber" | "action" | "paired-action" | "free-road";
      readonly turnNumber: number;
      readonly primaryPlayerId?: PlayerId;
    }
  | {
      readonly kind: "finished";
      readonly winnerId: PlayerId;
    };

export interface GameState {
  readonly id: GameId;
  readonly ruleProfile: RuleProfile;
  readonly victoryPointsToWin: number;
  readonly seed: number;
  readonly revision: number;
  readonly map: GameMap;
  readonly bank: ResourceHand;
  readonly buildings: readonly BuildingState[];
  readonly roads: readonly RoadState[];
  readonly players: readonly PlayerState[];
  readonly phase: GamePhase;
  readonly diceBag: BalancedDiceBagState;
  readonly lastRoll: readonly [number, number] | null;
  readonly pendingDiscards: readonly { readonly playerId: PlayerId; readonly count: number }[];
  readonly openTrade: TradeOfferState | null;
  readonly developmentDeck: readonly DevelopmentCardType[];
  readonly developmentCardPlayedThisTurn: boolean;
  readonly robberResumeStep: "roll" | "action" | "paired-action" | null;
  readonly freeRoadsRemaining: number;
  readonly freeRoadsGranted: number;
  readonly developmentResumeStep: "roll" | "action" | "paired-action" | null;
  readonly awards: AwardsState;
}
import type { AwardsState } from "../awards/index.js";
