import type { AnyRoomView } from "@catan/protocol/platform";
import type { PlayerSession } from "../../room-session.js";
import { RoomUpdates } from "../../room-updates.js";
import { CatanRoomSync } from "./room-sync.js";

export class CatanTestUpdates extends RoomUpdates {
  readonly sync: CatanRoomSync;
  constructor(session: PlayerSession | null, publish: (room: AnyRoomView | null) => void) {
    super(session, publish, () => this.sync);
    this.sync = new CatanRoomSync(this);
  }
}
