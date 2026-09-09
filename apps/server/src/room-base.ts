import type { PlayerColor } from "@catan/game-core/primitives";

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
  hostPlayerId: string;
  seed: number;
  revision: number;
  readonly members: RoomMember[];
  readonly appliedCommands: Set<string>;
  lastActiveAt: number;
}
