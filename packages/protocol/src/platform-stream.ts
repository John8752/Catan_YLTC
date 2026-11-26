import { isGameType, unregisteredGame, type AnyRoomView, type AnyRoomServerMessage } from "./platform/index.js";
import { MissingRoomMapError, ROOM_EVENT_TRANSPORT, ROOM_MAP_TRANSPORT, createRoomEventEncoder, createRoomStreamEncoder, createRoomStreamDecoder, type CachedRoomMessage, type IncrementalRoomMessage } from "./catan/room-stream.js";
import { carcassonneDelta, applyCarcassonneDelta, type CarcassonneDelta } from "./carcassonne/stream.js";
import { camelDelta, applyCamelDelta, type CamelDelta } from "./camel-up/stream.js";
export type PlatformWireMessage = AnyRoomServerMessage | CachedRoomMessage | IncrementalRoomMessage | CarcassonneDelta | CamelDelta;
export const PLATFORM_ROOM_TRANSPORT = "games-v3";
export const usesCatanEvents = (transport: string | undefined) => transport === PLATFORM_ROOM_TRANSPORT || transport === ROOM_EVENT_TRANSPORT;

/** One encoder per authenticated connection; only already-redacted views enter it. */
export function createPlatformRoomEncoder(transport?: string): (room: AnyRoomView) => PlatformWireMessage {
  const catan = usesCatanEvents(transport) ? createRoomEventEncoder() : transport === ROOM_MAP_TRANSPORT ? createRoomStreamEncoder() : null;
  let previous: AnyRoomView | null = null;
  return room => {
    const before = previous; previous = room;
    switch (room.gameId) {
      case "catan": return catan ? catan(room) : { type: "room_state", room };
      case "draw-guess": case "texas-holdem": return { type: "room_state", room };
      case "camel-up":
        if (before?.gameId === room.gameId && sameBaseline(before, room)) return camelDelta(before, room);
        return { type: "room_state", room };
      case "carcassonne":
        if (before?.gameId === room.gameId && sameBaseline(before, room)) return carcassonneDelta(before, room);
        return { type: "room_state", room };
      default: return unregisteredGame(room);
    }
  };
}
function sameBaseline(before: AnyRoomView, after: AnyRoomView) {
  return before.id === after.id && before.matchId === after.matchId && before.matchId !== null && before.game !== null && after.game !== null && before.game.you.id === after.game.you.id;
}
/** Map caches/event cursors are a Catan capability, never a requirement for another game. */
export function createPlatformRoomDecoder(): (message: PlatformWireMessage) => AnyRoomServerMessage {
  let decodeCatan: ReturnType<typeof createRoomStreamDecoder> | undefined;
  let previous: AnyRoomView | null = null;
  return (message) => {
    if(message.type==="room_state"&&!isGameType(message.room.gameId))return {type:"error",code:"UNKNOWN_GAME",message:"未知游戏类型，请返回大厅选择游戏。"};
    if (message.type === "room_state") {
      if (previous?.id === message.room.id && previous.gameId === message.room.gameId && message.room.revision <= previous.revision) return { type: "room_state", room: previous };
      previous = message.room; return message;
    }
    if (message.type === "carcassonne_delta" || message.type === "camel_delta") {
      const gameId = message.type === "carcassonne_delta" ? "carcassonne" : "camel-up";
      if (!previous || previous.gameId !== gameId || previous.id !== message.roomId || previous.matchId !== message.matchId || !previous.game || previous.game.you.id !== message.viewerId) throw new MissingRoomMapError("Game state baseline missing");
      if (message.revision <= previous.revision) return { type: "room_state", room: previous };
      if (message.baseRevision !== previous.revision) throw new MissingRoomMapError("Game state revision gap");
      try {
        if (message.type === "carcassonne_delta" && previous.gameId === "carcassonne") previous = applyCarcassonneDelta(previous, message);
        else if (message.type === "camel_delta" && previous.gameId === "camel-up") previous = applyCamelDelta(previous, message);
      } catch { throw new MissingRoomMapError("Invalid game state delta"); }
      return { type: "room_state", room: previous };
    }
    if (message.type !== "room_map_state" && message.type !== "room_event_state") return message;
    decodeCatan ??= createRoomStreamDecoder();
    return decodeCatan(message);
  };
}

export { MissingRoomMapError as RoomBaselineError };
