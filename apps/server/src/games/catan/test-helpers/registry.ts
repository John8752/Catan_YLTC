import type { RoomSession } from "@catan/protocol/platform";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { RoomView, } from "@catan/protocol/catan";
import { RoomRegistry as PlatformRegistry } from "../../../rooms.js";

/** Existing Catan scenarios fail loudly if accidentally routed to another game. */
function catan(view: AnyRoomView): RoomView {
  if (view.gameId !== "catan") throw new Error("Catan test received another game's room");
  return view;
}
export class RoomRegistry extends PlatformRegistry {
  override getRoom(...args: Parameters<PlatformRegistry["getRoom"]>): RoomView { return catan(super.getRoom(...args)); }
  override startRoom(...args: Parameters<PlatformRegistry["startRoom"]>): RoomView { return catan(super.startRoom(...args)); }
  override joinRoom(...args: Parameters<PlatformRegistry["joinRoom"]>): RoomSession<RoomView> { const session = super.joinRoom(...args); return { ...session, room: catan(session.room) }; }
  override subscribe(roomId: string, token: string, listener: (view: RoomView) => void, onClosed?: () => void, onReplaced?: () => void, incremental = false): () => void {
    return super.subscribe(roomId, token, (view) => listener(catan(view)), onClosed, onReplaced, incremental);
  }
}
