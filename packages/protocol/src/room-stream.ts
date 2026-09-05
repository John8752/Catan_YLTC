import type { GameMap } from "@catan/game-core";
import type { RoomServerMessage } from "./messages.js";
import type { GameView, RoomView } from "./views.js";

/** Opt-in keeps already-open clients usable during a rolling web/server release. */
export const ROOM_MAP_TRANSPORT = "map-cache-v1";
export const ROOM_EVENT_TRANSPORT = "events-v2";
type StaticMap = Omit<GameMap, "robberHexId">;
interface MapTransfer {
  readonly key: string;
  readonly geometry: StaticMap | null;
  readonly robberHexId: GameMap["robberHexId"];
}
export interface CachedRoomMessage {
  readonly type: "room_map_state";
  readonly room: Omit<RoomView, "game" | "previewMap"> & {
    readonly previewMap: MapTransfer | null;
    readonly game: (Omit<GameView, "map"> & { readonly map: MapTransfer }) | null;
  };
}
export interface IncrementalRoomMessage {
  readonly type: "room_event_state";
  readonly baseRevision: number | null;
  readonly room: CachedRoomMessage["room"];
}
export type RoomWireMessage = RoomServerMessage | CachedRoomMessage | IncrementalRoomMessage;

/** History/effects are already projected for this subscription's cursor by the server. */
export function createRoomEventEncoder(): (room: RoomView) => IncrementalRoomMessage {
  const encode = createRoomStreamEncoder();
  let previous: number | null = null;
  return (room) => {
    const message: IncrementalRoomMessage = { type: "room_event_state", baseRevision: previous, room: encode(room).room };
    previous = room.revision;
    return message;
  };
}

/** One encoder per socket. Only static, public geometry is remembered. */
export function createRoomStreamEncoder(): (room: RoomView) => CachedRoomMessage {
  let previousKey: string | null = null;
  return (room) => {
    function encode(map: GameMap): MapTransfer {
      const key = JSON.stringify([room.id, room.settings.ruleProfile, room.settings.mapSeed, map.generationVersion]);
      const { robberHexId, ...geometry } = map;
      const transfer = { key, robberHexId, geometry: key === previousKey ? null : geometry };
      previousKey = key;
      return transfer;
    }
    return {
      type: "room_map_state",
      room: { ...room, previewMap: room.previewMap === null ? null : encode(room.previewMap),
        game: room.game === null ? null : { ...room.game, map: encode(room.game.map) } },
    };
  };
}

export class MissingRoomMapError extends Error {
  constructor(message = "Room map baseline is missing; reconnect for a complete snapshot") { super(message); }
}
export class MissingRoomEventsError extends MissingRoomMapError {
  constructor() { super("Room event baseline is missing; reconnect to recover history"); }
}

/** A fresh decoder on reconnect requires fresh geometry; never reuses another seat's state. */
export function createRoomStreamDecoder(): (message: RoomWireMessage) => RoomServerMessage {
  let cached: { readonly key: string; readonly geometry: StaticMap } | null = null;
  let previous: Extract<RoomServerMessage, { type: "room_state" }> | null = null;
  return (message) => {
    if (message.type !== "room_map_state" && message.type !== "room_event_state") return message;
    if (message.type === "room_event_state") {
      if (previous !== null && message.room.id === previous.room.id && message.room.revision <= previous.room.revision) return previous;
      if (message.baseRevision !== (previous?.room.revision ?? null)) throw new MissingRoomEventsError();
    }
    function decode(map: MapTransfer): GameMap {
      if (map.geometry !== null) cached = { key: map.key, geometry: map.geometry };
      if (cached === null || cached.key !== map.key) throw new MissingRoomMapError();
      return { ...cached.geometry, robberHexId: map.robberHexId };
    }
    const { room } = message;
    const result: Extract<RoomServerMessage, { type: "room_state" }> = { type: "room_state", room: { ...room,
      previewMap: room.previewMap === null ? null : decode(room.previewMap),
      game: room.game === null ? null : { ...room.game, map: decode(room.game.map) },
    } };
    if (message.type === "room_event_state") previous = result;
    return result;
  };
}
