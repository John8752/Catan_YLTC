import type { PlayerSession } from "./api.js";

const SESSION_KEY = "catan-yltc-session";

export interface SessionStorageArea {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PlayerSessionStore {
  read(): PlayerSession | null;
  write(session: PlayerSession): void;
  clear(): void;
}

export function createPlayerSessionStore(storage: SessionStorageArea): PlayerSessionStore {
  return {
    read(): PlayerSession | null {
      const serialized = storage.getItem(SESSION_KEY);

      if (serialized === null) return null;

      try {
        const value = JSON.parse(serialized) as Partial<PlayerSession>;
        return typeof value.roomId === "string" && typeof value.playerId === "string" && typeof value.seatToken === "string"
          ? { roomId: value.roomId, playerId: value.playerId, seatToken: value.seatToken }
          : null;
      } catch {
        return null;
      }
    },

    write(session: PlayerSession): void {
      storage.setItem(SESSION_KEY, JSON.stringify(session));
    },

    clear(): void {
      storage.removeItem(SESSION_KEY);
    },
  };
}

export function clearLegacySharedSession(storage: SessionStorageArea): void {
  storage.removeItem(SESSION_KEY);
}
