import type { GameMap } from "@catan/game-core";
import type { RoomServerMessage } from "./messages.js";
import type { GameView, RoomView } from "./views.js";

/** Opt-in keeps already-open clients usable during a rolling web/server release. */
export const ROOM_MAP_TRANSPORT = "map-cache-v1";
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
export type RoomWireMessage = RoomServerMessage | CachedRoomMessage;

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
  constructor() { super("Room map baseline is missing; reconnect for a complete snapshot"); }
}

/** A fresh decoder on reconnect requires fresh geometry; never reuses another seat's state. */
export function createRoomStreamDecoder(): (message: RoomWireMessage) => RoomServerMessage {
  let cached: { readonly key: string; readonly geometry: StaticMap } | null = null;
  return (message) => {
    if (message.type !== "room_map_state") return message;
    function decode(map: MapTransfer): GameMap {
      if (map.geometry !== null) cached = { key: map.key, geometry: map.geometry };
      if (cached === null || cached.key !== map.key) throw new MissingRoomMapError();
      return { ...cached.geometry, robberHexId: map.robberHexId };
    }
    const { room } = message;
    return { type: "room_state", room: { ...room,
      previewMap: room.previewMap === null ? null : decode(room.previewMap),
      game: room.game === null ? null : { ...room.game, map: decode(room.game.map) },
    } };
  };
}
