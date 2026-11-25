import { describe, expect, it } from "vitest";
import { createCamelUp, executeCamelUp, rankCamels, type CamelState, type CamelAction, type RollInput, RACING_CAMELS } from "./index.js";

const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` }));
const setup = { positions: [1, 1, 2, 2, 3], order: RACING_CAMELS, crazyPositions: [1, 2] } as const;
function game(count = 3) { return createCamelUp("m", players.slice(0, count), setup); }
function act(s: CamelState, action: CamelAction, roll?: RollInput) {
  if (s.phase.kind !== "racing") throw Error("finished");
  return executeCamelUp(s, s.phase.activePlayerId, { ...action, matchId: s.id, expectedRevision: s.revision }, roll);
}
describe("camel-up deterministic second-edition rules", () => {
  it("copies only domain player fields from structurally wider input", () => {
    const members = players.slice(0, 3).map(p => ({ ...p, seatToken: `secret-${p.id}`, accountId: `account-${p.id}`, color: "coral" }));
    const s = createCamelUp("m", members, setup);
    expect(s.players[0]).toEqual({ id: "p0", name: "玩家0", coins: 3, tickets: [], pyramidTickets: 0, partnerId: null });
    expect(JSON.stringify(s)).not.toContain("secret-");
    expect(JSON.stringify(s)).not.toContain("account-");
  });
  it("moves a camel and everything above it, keeping input immutable", () => {
    const s = game(); const before = structuredClone(s);
    const n = act(s, { type: "roll" }, { die: "blue", value: 1, crazy: "black" });
    expect(n.stacks[2]).toEqual(["yellow", "red", "blue", "green"]);
    expect(rankCamels(n)).toEqual(["purple", "green", "blue", "red", "yellow"]);
    expect(s).toEqual(before);
  });
  it("rejects wrong turns, stale matches/revisions and already revealed dice", () => {
    const s = game(); const command = { type: "roll", matchId: "m", expectedRevision: 0 } as const;
    expect(() => executeCamelUp(s, "p1", command)).toThrow();
    expect(() => executeCamelUp(s, "p0", { ...command, matchId: "old" })).toThrow();
    expect(() => executeCamelUp(s, "p0", { ...command, expectedRevision: 9 })).toThrow();
    const n = act(s, { type: "roll" }, { die: "blue", value: 1, crazy: "black" });
    expect(() => act(n, { type: "roll" }, { die: "blue", value: 1, crazy: "black" })).toThrow();
  });
  it("places a booing unit underneath and rewards the tile owner", () => {
    const s = game(); s.stacks = { 2: ["blue"], 3: ["green"], 8: ["yellow", "red", "purple"], 15: ["black", "white"] };
    s.tiles = [{ playerId: "p2", space: 4, side: "boo" }];
    const n = act(s, { type: "roll" }, { die: "blue", value: 2, crazy: "black" });
    expect(n.stacks[3]).toEqual(["blue", "green"]); expect(n.players[2]?.coins).toBe(4);
  });
  it("rejects occupied, adjacent and first-space tiles; moves own tile", () => {
    const s = game();
    expect(() => act(s, { type: "tile", space: 1, side: "cheer" })).toThrow();
    expect(() => act(s, { type: "tile", space: 3, side: "cheer" })).toThrow();
    const n = act(s, { type: "tile", space: 6, side: "cheer" });
    expect(() => act(n, { type: "tile", space: 7, side: "boo" })).toThrow();
    expect(() => act(n, { type: "tile", space: 6, side: "boo" })).toThrow();
    n.phase = { kind: "racing", activePlayerId: "p0" };
    expect(act(n, { type: "tile", space: 9, side: "boo" }).tiles).toEqual([{ playerId: "p0", space: 9, side: "boo" }]);
  });
  it("applies grey-die carrying and directly-stacked crazy exceptions", () => {
    const s = game(); s.stacks = { 5: ["black", "blue"], 8: ["white"], 2: ["green", "yellow", "red", "purple"] };
    expect(act(s, { type: "roll" }, { die: "grey", value: 2, crazy: "white" }).stacks[3]).toEqual(["black", "blue"]);
    s.stacks = { 5: ["black", "white", "blue"], 2: ["green", "yellow", "red", "purple"] };
    expect(act(s, { type: "roll" }, { die: "grey", value: 1, crazy: "black" }).stacks[4]).toEqual(["white", "blue"]);
  });
  it("uses five of six dice, resets tickets/tiles and keeps next player", () => {
    let s = game(); s = act(s, { type: "ticket", camel: "purple" }); s = act(s, { type: "tile", space: 9, side: "cheer" });
    for (const die of RACING_CAMELS) s = act(s, { type: "roll" }, { die, value: 1, crazy: "black" });
    expect(s.leg).toBe(2); expect(s.remainingDice).toHaveLength(6); expect(s.tiles).toEqual([]);
    expect(s.players[0]?.tickets).toEqual([]); expect(s.lastLeg?.leg).toBe(1);
    expect(s.phase).toEqual({ kind: "racing", activePlayerId: "p1" });
  });
  it("shares the five finish cards across winner/loser bets", () => {
    let s = act(game(), { type: "finish-bet", camel: "blue", kind: "winner" });
    s.phase = { kind: "racing", activePlayerId: "p0" };
    expect(() => act(s, { type: "finish-bet", camel: "blue", kind: "loser" })).toThrow();
    expect(s.log.join(" ")).not.toContain("blue");
  });
  it("finishes on a reverse crossing, ranks carried racers last, pays in bet order", () => {
    const s = game(); s.stacks = { 1: ["black", "blue"], 8: ["green", "yellow", "red", "purple"], 14: ["white"] };
    s.finishBets = [{ playerId: "p1", camel: "purple", kind: "winner" }, { playerId: "p0", camel: "purple", kind: "winner" }, { playerId: "p2", camel: "blue", kind: "loser" }];
    const n = act(s, { type: "roll" }, { die: "grey", value: 1, crazy: "white" });
    expect(n.phase).toEqual({ kind: "finished", winnerIds: ["p1", "p2"] });
    expect(rankCamels(n).at(-1)).toBe("blue"); expect(n.players.map(p => p.coins)).toEqual([9, 11, 11]);
    expect(() => executeCamelUp(n, "p1", { type: "roll", matchId: "m", expectedRevision: n.revision })).toThrow();
  });
  it("copies a partner's best positive ticket and nets losses before clamping", () => {
    const s = game(6); const n = act(s, { type: "partner", playerId: "p1" });
    expect(n.players[1]?.partnerId).toBe("p0");
    n.players[0]!.coins = 0; n.players[0]!.tickets = [{ camel: "blue", value: 5 }];
    n.players[1]!.tickets = [{ camel: "purple", value: 5 }];
    n.stacks = { 15: ["purple"], 2: ["blue", "green", "yellow", "red"], 12: ["black", "white"] };
    const done = act(n, { type: "roll" }, { die: "purple", value: 2, crazy: "black" });
    expect(done.players[0]?.coins).toBe(4); expect(done.lastLeg?.deltas[0]?.partnerBonus).toBe(5);
    expect(() => act(game(), { type: "partner", playerId: "p1" })).toThrow();
  });
  it("applies crazy-camel spectator directions and pays even if a stack is carried", () => {
    const s = game(); s.stacks = { 7: ["black", "blue"], 9: ["white"], 2: ["green", "yellow", "red", "purple"] };
    s.tiles = [{ playerId: "p2", space: 5, side: "boo" }];
    const n = act(s, { type: "roll" }, { die: "grey", value: 2, crazy: "white" });
    expect(n.stacks[6]).toEqual(["black", "blue"]); expect(n.players[2]?.coins).toBe(4);
    s.tiles[0]!.side = "cheer";
    expect(act(s, { type: "roll" }, { die: "grey", value: 2, crazy: "white" }).stacks[4]).toEqual(["black", "blue"]);
  });
  it("nets winning and losing tickets together, never clamps each ticket separately", () => {
    const s = game(); s.players[0]!.coins = 0;
    s.players[0]!.tickets = [{ camel: "blue", value: 5 }, { camel: "purple", value: 5 }];
    s.stacks = { 15: ["purple"], 2: ["blue", "green", "yellow", "red"], 12: ["black", "white"] };
    const n = act(s, { type: "roll" }, { die: "purple", value: 2, crazy: "black" });
    expect(n.players[0]?.coins).toBe(5); // −1 +5 +1 pyramid, as one leg total.
  });
  it("replays complete races exactly with no lost, duplicate or misranked camels", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = game(seed % 2 ? 3 : 6), random = seed, steps = 0;
      const replay: { command: CamelAction; roll: RollInput }[] = [];
      while (s.phase.kind === "racing" && steps++ < 500) {
        random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
        const roll: RollInput = { die: s.remainingDice[random % s.remainingDice.length]!, value: (random % 3 + 1) as 1 | 2 | 3, crazy: random % 2 ? "black" : "white" };
        replay.push({ command: { type: "roll" }, roll }); s = act(s, { type: "roll" }, roll);
        const camels = Object.values(s.stacks).flat();
        expect(camels).toHaveLength(7); expect(new Set(camels).size).toBe(7); expect(rankCamels(s)).toHaveLength(5);
        expect(s.players.every(p => Number.isInteger(p.coins) && p.coins >= 0)).toBe(true);
        expect(s.remainingDice.length + s.rolls.length).toBe(6);
      }
      expect(s.phase.kind).toBe("finished");
      const again = replay.reduce((n, entry) => act(n, entry.command, entry.roll), game(seed % 2 ? 3 : 6));
      expect(again).toEqual(s);
    }
  });
});
