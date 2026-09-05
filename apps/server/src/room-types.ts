import type { GameState, GameEventRecord, PlayerColor } from "@catan/game-core";
import type { RoomSettingsInput, RoomView, VictoryWarningEffectView, PublicSetupAnalysisView } from "@catan/protocol";

export interface RoomMember {
  readonly id: string;
  seatToken: string;
  accountId: string | null;
  readonly name: string;
  color: PlayerColor;
}

export interface RoomRecord {
  readonly id: string;
  readonly matchId: string;
  startedAt: number;
  hostPlayerId: string;
  seed: number;
  revision: number;
  readonly members: RoomMember[];
  settings: RoomSettingsInput;
  game: GameState | null;
  /** Keys of commands already applied, so a client retry is not replayed. */
  readonly appliedCommands: Set<string>;
  readonly history: GameEventRecord[];
  /** Derived public milestones, bounded to three per seat; never game legality. */
  readonly victoryWarnings: VictoryWarningEffectView[];
  publicSetupAnalysis: PublicSetupAnalysisView | null;
  /** Per player, the turn number whose intent read they have already spent. */
  readonly tableIntentTurns: Map<string, number>;
  lastActiveAt: number;
}

export type RoomListener = (room: RoomView) => void;

export interface Subscription {
  /** undefined: legacy snapshots; null: first events-v2 snapshot; number: last sent game revision. */
  eventAfterRevision?: number | null | undefined;
  readonly playerId: string;
  readonly listener: RoomListener;
  /** Told once when the room is disbanded, so a socket can say why it is closing. */
  readonly onReplaced?: (() => void) | undefined;
  readonly onClosed?: (() => void) | undefined;
}
