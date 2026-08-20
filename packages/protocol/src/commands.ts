import type { GameCommand } from "@catan/game-core";
import type { RoomView } from "./views.js";

export type { GameCommand } from "@catan/game-core";

export interface SubmitGameCommandRequest {
  readonly seatToken: string;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly command: GameCommand;
}

export interface GameCommandResponse {
  readonly commandId: string;
  readonly room: RoomView;
}
