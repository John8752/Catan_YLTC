import type { CamelState } from "@catan/game-core/camel-up";
import type { RoomBase } from "../../room-base.js";
export interface CamelRoomRecord extends RoomBase { readonly gameId: "camel-up"; game: CamelState | null }
