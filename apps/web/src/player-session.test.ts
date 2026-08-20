import { describe, expect, it } from "vitest";
import { createPlayerSessionStore, type SessionStorageArea } from "./player-session.js";

describe("per-tab player sessions", () => {
  it("keeps identities isolated between browser tab storage areas", () => {
    const firstTab = createPlayerSessionStore(createMemoryStorage());
    const secondTab = createPlayerSessionStore(createMemoryStorage());

    firstTab.write({ roomId: "A1B2C3", playerId: "player_host" });

    expect(firstTab.read()).toEqual({ roomId: "A1B2C3", playerId: "player_host" });
    expect(secondTab.read()).toBeNull();
  });

  it("restores an identity from the same tab storage after a refresh", () => {
    const storage = createMemoryStorage();
    const beforeRefresh = createPlayerSessionStore(storage);
    beforeRefresh.write({ roomId: "A1B2C3", playerId: "player_guest" });

    const afterRefresh = createPlayerSessionStore(storage);

    expect(afterRefresh.read()).toEqual({ roomId: "A1B2C3", playerId: "player_guest" });
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
