import { describe, expect, it } from "vitest";
import {
  adoptLegacyTabSession,
  createPlayerSessionStore,
  nextFreeSeatSlot,
  seatSlotFromLocation,
  type SessionStorageArea,
} from "./player-session.js";

describe("player sessions", () => {
  it("keeps identities isolated between browser tab storage areas", () => {
    const firstTab = createPlayerSessionStore(createMemoryStorage());
    const secondTab = createPlayerSessionStore(createMemoryStorage());

    firstTab.write({ roomId: "A1B2C3", playerId: "player_host", seatToken: "seat_host" });

    expect(firstTab.read()).toEqual({ roomId: "A1B2C3", playerId: "player_host", seatToken: "seat_host" });
    expect(secondTab.read()).toBeNull();
  });

  it("keeps one browser's seats apart by slot while sharing one storage area", () => {
    const browser = createMemoryStorage();
    const firstSeat = createPlayerSessionStore(browser, "1");
    const secondSeat = createPlayerSessionStore(browser, "2");

    firstSeat.write({ roomId: "A1B2C3", playerId: "player_one", seatToken: "seat_one" });
    secondSeat.write({ roomId: "A1B2C3", playerId: "player_two", seatToken: "seat_two" });

    expect(firstSeat.read()?.playerId).toBe("player_one");
    expect(secondSeat.read()?.playerId).toBe("player_two");

    // Reopening a tab at the same slot must find the seat again -- that is the
    // whole point of putting the slot in the URL rather than in tab storage.
    expect(createPlayerSessionStore(browser, "2").read()?.playerId).toBe("player_two");

    secondSeat.clear();
    expect(secondSeat.read()).toBeNull();
    expect(firstSeat.read()?.playerId).toBe("player_one");
  });

  it("reads the seat slot from the query string and rejects junk", () => {
    expect(seatSlotFromLocation("")).toBe("1");
    expect(seatSlotFromLocation("?seat=2")).toBe("2");
    expect(seatSlotFromLocation("?seat=B")).toBe("b");
    expect(seatSlotFromLocation("?seat=")).toBe("1");
    expect(seatSlotFromLocation("?seat=../../etc")).toBe("1");
    expect(seatSlotFromLocation("?seat=aVeryLongSlotName")).toBe("1");
  });

  it("offers the lowest slot this browser is not already sitting at", () => {
    const browser = createMemoryStorage();
    expect(nextFreeSeatSlot(browser)).toBe("1");

    createPlayerSessionStore(browser, "1").write({ roomId: "A", playerId: "p1", seatToken: "s1" });
    expect(nextFreeSeatSlot(browser)).toBe("2");

    createPlayerSessionStore(browser, "2").write({ roomId: "A", playerId: "p2", seatToken: "s2" });
    expect(nextFreeSeatSlot(browser)).toBe("3");
  });

  it("carries a seat over from the old per-tab storage exactly once", () => {
    const tab = createMemoryStorage();
    const browser = createMemoryStorage();
    const legacy = { roomId: "A1B2C3", playerId: "player_old", seatToken: "seat_old" };
    tab.setItem("catan-yltc-session", JSON.stringify(legacy));

    adoptLegacyTabSession(tab, browser);

    expect(createPlayerSessionStore(browser, "1").read()).toEqual(legacy);
    // The old copy is gone, so a later release cannot resurrect a stale seat.
    expect(tab.getItem("catan-yltc-session")).toBeNull();
  });

  it("never lets a legacy seat overwrite one already held in the default slot", () => {
    const tab = createMemoryStorage();
    const browser = createMemoryStorage();
    tab.setItem("catan-yltc-session", JSON.stringify({ roomId: "OLD", playerId: "p_old", seatToken: "s_old" }));
    createPlayerSessionStore(browser, "1").write({ roomId: "NEW", playerId: "p_new", seatToken: "s_new" });

    adoptLegacyTabSession(tab, browser);

    expect(createPlayerSessionStore(browser, "1").read()?.roomId).toBe("NEW");
  });

  it("restores an identity from the same tab storage after a refresh", () => {
    const storage = createMemoryStorage();
    const beforeRefresh = createPlayerSessionStore(storage);
    beforeRefresh.write({ roomId: "A1B2C3", playerId: "player_guest", seatToken: "seat_guest" });

    const afterRefresh = createPlayerSessionStore(storage);

    expect(afterRefresh.read()).toEqual({ roomId: "A1B2C3", playerId: "player_guest", seatToken: "seat_guest" });
  });
});

function createMemoryStorage(): SessionStorageArea {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
