import type { PlayerColor } from "@catan/game-core/primitives";
import type { GameType } from "./index.js";

export interface LobbyMemberView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly isHost: boolean;
}
export interface RoomBaseView {
  readonly id: string;
  readonly gameId: GameType;
  /** Null in a fresh lobby; a new value is allocated on every start. */
  readonly matchId: string | null;
  readonly revision: number;
  readonly hostPlayerId: string;
  readonly members: readonly LobbyMemberView[];
}
