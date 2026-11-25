import {unregisteredGame} from "@catan/protocol/platform";
import type { RoomPolicyFactory } from "../room-updates.js";
import { CatanRoomSync } from "./catan/room-sync.js";

/** Snapshot-only games are explicit choices, never a catch-all policy. */
export const createGameRoomPolicy:RoomPolicyFactory=(gameId,updates)=>{
  switch(gameId){
    case "catan":return new CatanRoomSync(updates);
    case "draw-guess":return null;
    case "camel-up":return null;
    case "carcassonne":return null;
    case "texas-holdem":return null;
    default:return unregisteredGame(gameId);
  }
};
