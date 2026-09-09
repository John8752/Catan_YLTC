import type { AnyRoomView } from "@catan/protocol/platform";
import type { CatanRoomRecord } from "./games/catan/room-types.js";
import type { DrawGuessRoomRecord } from "./games/draw-guess/room-types.js";
export type AnyRoomRecord = CatanRoomRecord | DrawGuessRoomRecord;

export type RoomListener = (room: AnyRoomView) => void;

export interface Subscription {
  /** undefined: legacy snapshots; null: first events-v2 snapshot; number: last sent game revision. */
  eventAfterRevision?: number | null | undefined;
  readonly playerId: string;
  readonly listener: RoomListener;
  /** Told once when the room is disbanded, so a socket can say why it is closing. */
  readonly onReplaced?: (() => void) | undefined;
  readonly onClosed?: (() => void) | undefined;
}
