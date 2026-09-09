import type { RoomPolicyFactory } from "../room-updates.js";
import { CatanRoomSync } from "./catan/room-sync.js";

/** Deliberately small dispatch: drawing snapshots need no reconciliation policy. */
export const createGameRoomPolicy: RoomPolicyFactory = (gameId, updates) =>
  gameId === "catan" ? new CatanRoomSync(updates) : null;
