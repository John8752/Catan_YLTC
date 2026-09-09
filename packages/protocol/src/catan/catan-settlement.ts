import type { PlayerColor, PlayableRuleProfile } from "@catan/game-core/catan";
import type { GameSummaryView } from "./game-summary.js";

export const CATAN_GAME_ID = "catan" as const;
export interface CatanSettlementV1 {
  readonly ruleProfile: PlayableRuleProfile;
  readonly victoryPointsToWin: number;
  readonly winnerId: string;
  readonly players: readonly { readonly id: string; readonly name: string; readonly color: PlayerColor }[];
  readonly summary: GameSummaryView;
}
