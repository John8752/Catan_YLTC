import type { PokerState, PokerSettings } from "@catan/game-core/texas-holdem";
import type { RoomBase } from "../../room-base.js";
export interface PokerRoomRecord extends RoomBase { readonly gameId: "texas-holdem"; settings: PokerSettings; game: PokerState | null }
