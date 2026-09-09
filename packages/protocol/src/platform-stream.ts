import type { AnyRoomServerMessage } from "./platform/index.js";
import { MissingRoomMapError, ROOM_EVENT_TRANSPORT, createRoomStreamDecoder, type CachedRoomMessage, type IncrementalRoomMessage } from "./catan/room-stream.js";
export type PlatformWireMessage = AnyRoomServerMessage | CachedRoomMessage | IncrementalRoomMessage;
/** Map caches/event cursors are a Catan capability, never a requirement for another game. */
export function createPlatformRoomDecoder(): (message: PlatformWireMessage) => AnyRoomServerMessage {
  let decodeCatan: ReturnType<typeof createRoomStreamDecoder> | undefined;
  return (message) => {
    if (message.type !== "room_map_state" && message.type !== "room_event_state") return message;
    decodeCatan ??= createRoomStreamDecoder();
    return decodeCatan(message);
  };
}

/** Current wire negotiation retains deployed Catan clients and passes other games through. */
export const PLATFORM_ROOM_TRANSPORT = ROOM_EVENT_TRANSPORT;
export { MissingRoomMapError as RoomBaselineError };
