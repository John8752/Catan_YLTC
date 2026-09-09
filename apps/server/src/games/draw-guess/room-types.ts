import type { DrawGuessState } from "@catan/game-core/draw-guess";
import type { DrawGuessSettings } from "@catan/protocol/draw-guess";
import type { RoomBase } from "../../room-base.js";

export interface DrawGuessRoomRecord extends RoomBase {
  readonly gameId: "draw-guess";
  settings: DrawGuessSettings;
  game: DrawGuessState | null;
}
