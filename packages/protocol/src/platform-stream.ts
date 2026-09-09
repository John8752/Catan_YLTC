import type { AnyRoomServerMessage } from "./platform.js";
import { createRoomStreamDecoder, type CachedRoomMessage, type IncrementalRoomMessage } from "./room-stream.js";
export type PlatformWireMessage = AnyRoomServerMessage | CachedRoomMessage | IncrementalRoomMessage;
/** Map caches/event cursors are a Catan capability, never a requirement for another game. */
export function createPlatformRoomDecoder(): (message: PlatformWireMessage) => AnyRoomServerMessage {
  const decodeCatan = createRoomStreamDecoder();
  return (message) => message.type === "room_map_state" || message.type === "room_event_state" ? decodeCatan(message) : message;
}
