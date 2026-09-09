import type { GameState, GameEventRecord, PlayerColor } from "@catan/game-core";
import type { AnyRoomView, RoomSettingsInput, VictoryWarningEffectView, PublicSetupAnalysisView } from "@catan/protocol";
import type { DrawGuessState } from "@catan/game-core/draw-guess";
import type { DrawGuessSettings } from "@catan/protocol/draw-guess";

export interface RoomMember {
  readonly id: string;
  seatToken: string;
  accountId: string | null;
  readonly name: string;
  color: PlayerColor;
}

export interface RoomBase {
  readonly id: string;
  matchId: string | null;
  startedAt: number;
  matchesStarted: number;
  hostPlayerId: string;
  seed: number;
  revision: number;
  readonly members: RoomMember[];
  readonly appliedCommands: Set<string>;
  lastActiveAt: number;
}

/** Game-specific payloads never have to fabricate another game's fields. */
export interface RoomRecord extends RoomBase {
  readonly gameId: "catan";
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

export interface DrawRoomRecord extends RoomBase {
  readonly gameId: "draw-guess";
  settings: DrawGuessSettings;
  game: DrawGuessState | null;
}
export type AnyRoomRecord = RoomRecord | DrawRoomRecord;

export type RoomListener = (room: AnyRoomView) => void;

export interface Subscription {
  /** undefined: legacy snapshots; null: first events-v2 snapshot; number: last sent game revision. */
  eventAfterRevision?: number | null | undefined;
  readonly playerId: string;
  readonly listener: RoomListener;
  /** Told once when the room is disbanded, so a socket can say why it is closing. */
  readonly onReplaced?: (() => void) | undefined;
  readonly onClosed?: (() => void) | undefined;
}
