import type { GameCommand } from "@catan/game-core";
import type { RoomView } from "./views.js";

export type { GameCommand } from "@catan/game-core";

export interface SubmitGameCommandRequest {
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
  readonly commandId: string;
  readonly roomId: string;
  readonly roomRevision: number;
  readonly gameRevision: number;
}
export type GameCommandReply = GameCommandResponse | GameCommandAck;
