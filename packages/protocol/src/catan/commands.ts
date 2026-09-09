import type { GameCommand } from "@catan/game-core/catan";
import type { RoomView } from "./views.js";

export type { GameCommand } from "@catan/game-core/catan";

export interface SubmitGameCommandRequest {
  readonly matchId?: string;
  readonly responseMode?: "ack";
  readonly seatToken: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly command: GameCommand;
}

export interface GameCommandResponse {
  readonly commandId: string;
  readonly room: RoomView;
}

/** Current authoritative revisions, also returned on an idempotent retry. */
export interface GameCommandAck {
  readonly matchId?: string;
  readonly commandId: string;
  readonly roomId: string;
  readonly roomRevision: number;
  readonly gameRevision: number;
}
export type GameCommandReply = GameCommandResponse | GameCommandAck;
