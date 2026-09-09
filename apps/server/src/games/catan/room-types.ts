import type { GameState, GameEventRecord } from "@catan/game-core/catan";
import type { RoomSettingsInput, VictoryWarningEffectView, PublicSetupAnalysisView } from "@catan/protocol/catan";
import type { RoomBase } from "../../room-base.js";

export interface CatanRoomRecord extends RoomBase {
  readonly gameId: "catan";
  matchesStarted: number;
  settings: RoomSettingsInput;
  game: GameState | null;
  /** Keys of commands already applied, so a client retry is not replayed. */
  readonly history: GameEventRecord[];
  /** Derived public milestones, bounded to three per seat; never game legality. */
  readonly victoryWarnings: VictoryWarningEffectView[];
  publicSetupAnalysis: PublicSetupAnalysisView | null;
  /** Per player, the turn number whose intent read they have already spent. */
  readonly tableIntentTurns: Map<string, number>;
}
