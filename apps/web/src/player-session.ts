import type { PlayerSession } from "./api.js";

const SEAT_KEY_PREFIX = "catan-yltc-seat";
const LEGACY_SESSION_KEY = "catan-yltc-session";

/** The slot a tab uses when the URL does not ask for another one. */
export const DEFAULT_SEAT_SLOT = "1";
const SEAT_SLOT_PATTERN = /^[a-z0-9]{1,8}$/;

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

/**
 * Which seat this tab holds, read from `?seat=`.
 *
 * Seats persist per browser rather than per tab, so one person keeps their seat
 * across a closed tab or a restarted browser. Sitting at a second seat in the
 * same browser -- which is really only wanted when testing locally -- is asked
 * for explicitly, and the slot lives in the URL because that is the one thing
 * that survives both a reload and reopening the tab later.
 */
export function seatSlotFromLocation(search: string): string {
  const requested = new URLSearchParams(search).get("seat")?.trim().toLowerCase();
  return requested !== undefined && SEAT_SLOT_PATTERN.test(requested) ? requested : DEFAULT_SEAT_SLOT;
}

export function seatStorageKey(slot: string): string {
  return slot === DEFAULT_SEAT_SLOT ? SEAT_KEY_PREFIX : `${SEAT_KEY_PREFIX}:${slot}`;
}

export function createPlayerSessionStore(
  storage: SessionStorageArea,
  slot: string = DEFAULT_SEAT_SLOT,
): PlayerSessionStore {
  const key = seatStorageKey(slot);

  return {
    read(): PlayerSession | null {
      return parseSession(storage.getItem(key));
    },

    write(session: PlayerSession): void {
      storage.setItem(key, JSON.stringify(session));
    },

    clear(): void {
      storage.removeItem(key);
    },
  };
}

/**
 * Moves a seat held by the previous per-tab storage into the durable one, so a
 * player mid-match keeps their seat across the release that changed this.
 * Only the default slot can inherit: the old storage had no notion of slots.
 */
export function adoptLegacyTabSession(
  tabStorage: SessionStorageArea,
  durableStorage: SessionStorageArea,
): void {
  const legacy = parseSession(tabStorage.getItem(LEGACY_SESSION_KEY));
  if (legacy === null) return;

  tabStorage.removeItem(LEGACY_SESSION_KEY);
  const key = seatStorageKey(DEFAULT_SEAT_SLOT);
  if (durableStorage.getItem(key) === null) {
    durableStorage.setItem(key, JSON.stringify(legacy));
  }
}

/** The lowest slot this browser is not already sitting at. */
export function nextFreeSeatSlot(storage: SessionStorageArea, limit = 9): string {
  for (let candidate = 1; candidate <= limit; candidate += 1) {
    const slot = String(candidate);
    if (storage.getItem(seatStorageKey(slot)) === null) return slot;
  }
  return String(limit);
}

function parseSession(serialized: string | null): PlayerSession | null {
  if (serialized === null) return null;

  try {
    const value = JSON.parse(serialized) as Partial<PlayerSession>;
    return typeof value.roomId === "string" && typeof value.playerId === "string" && typeof value.seatToken === "string"
      ? { roomId: value.roomId, playerId: value.playerId, seatToken: value.seatToken }
      : null;
  } catch {
    return null;
  }
}
