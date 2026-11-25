import type { CarcassonneState } from "@catan/game-core/carcassonne";
import type { RoomBase } from "../../room-base.js";
export interface CarcassonneRoomRecord extends RoomBase { readonly gameId: "carcassonne"; game: CarcassonneState | null }
