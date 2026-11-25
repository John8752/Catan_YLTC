import { describe, expect, it } from "vitest";
import { createSeededRandom, shuffled } from "../primitives/index.js";
import { createPoker, actPoker, nextPokerHand, freshDeck, DEFAULT_POKER_SETTINGS, pokerLegalActions, pokerStandings, type PokerMode, type PokerAction } from "./index.js";
import { settleHand } from "./settlement.js";

describe("texas-holdem replay and edge cases", () => {
  it.each(["fixed-hands", "tournament"] as PokerMode[])("replays %s for 2–9 players with conserved chips, unique cards and bounded turns", (mode) => {
    for (let count = 2; count <= 9; count++) for (let seed = 1; seed <= 12; seed++) {
      const run = () => {
        const rng = createSeededRandom(seed * 97 + count);
        let s = createPoker("replay", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `玩家${i}` })), { ...DEFAULT_POKER_SETTINGS, mode, handLimit: 12, blindInterval: 2, startingChips: 100 }, shuffled(freshDeck(), rng));
        let steps = 0;
        while (s.phase.kind !== "finished" && steps++ < 5000) {
          if (s.phase.kind === "hand-over") s = nextPokerHand(s, shuffled(freshDeck(), rng));
          else {
            const id = s.phase.actorId, legal = pokerLegalActions(s, id), n = rng.next();
            const action: PokerAction = n < .12 ? { type: "fold" } : n < .3 && legal.allIn ? { type: "all-in" } : n < .55 && legal.minRaiseTo !== null ? { type: "raise", to: legal.minRaiseTo } : { type: legal.check ? "check" : "call" };
            s = actPoker(s, id, action);
          }
          expect(s.players.reduce((n, p) => n + p.chips + p.totalBet, 0)).toBe(count * 100);
          expect(s.players.every((p) => Number.isSafeInteger(p.chips) && p.chips >= 0)).toBe(true);
          const visible = [...s.board, ...s.players.flatMap((p) => p.hole)]; expect(new Set(visible).size).toBe(visible.length);
        }
        expect(s.phase.kind).toBe("finished"); expect(steps).toBeLessThan(5000); return s;
      };
      expect(run()).toEqual(run());
    }
  });
  it("reopens after multiple short all-ins cumulatively reach a full raise", () => {
    let s = createPoker("m", Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, name: `${i}` })), DEFAULT_POKER_SETTINGS, freshDeck());
    s = actPoker(s, "3", { type: "raise", to: 100 });
    s = { ...s, players: s.players.map((p) => p.id === "4" ? { ...p, chips: 140 } : p.id === "0" ? { ...p, chips: 180 } : p) };
    s = actPoker(s, "4", { type: "all-in" }); s = actPoker(s, "0", { type: "all-in" });
    s = actPoker(s, "1", { type: "call" }); s = actPoker(s, "2", { type: "call" });
    expect(pokerLegalActions(s, "3").minRaiseTo).toBe(260);
    expect(actPoker(s, "3", { type: "raise", to: 260 }).currentBet).toBe(260);
  });
  it("awards an odd chip left of the button for a shared board and excludes folded hands", () => {
    const s = createPoker("m", ["a", "b", "c"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s.board = ["AS", "KS", "QS", "JS", "TS"];
    const holes = [["2D", "3D"], ["4H", "5H"], ["6C", "7C"]] as typeof s.board[];
    s.players.forEach((p, i) => { p.hole = holes[i]!; p.chips = 999; p.totalBet = 1; p.streetBet = 1; p.folded = i === 2; });
    settleHand(s, "showdown");
    expect(s.result!.pots[0]!.shares).toEqual([{ playerId: "b", amount: 2 }, { playerId: "a", amount: 1 }]);
    expect(s.result!.shown.map((p) => p.playerId)).toEqual(["a", "b"]);
    expect(pokerStandings(s).map((p) => p.playerId)).toEqual(["b", "a", "c"]);
  });
  it("awards the main pot and side pot to different players and refunds unmatched excess", () => {
    const s = createPoker("m", ["a", "b", "c"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s.board = ["2S", "3H", "7D", "8C", "9S"];
    const holes = [["KS", "KH"], ["AS", "AH"], ["QS", "QH"]] as typeof s.board[];
    s.players.forEach((p, i) => { p.hole = holes[i]!; p.chips = 0; p.totalBet = [300, 100, 200][i]!; p.startChips = p.totalBet; p.folded = false; });
    s.totalChips = 600; settleHand(s, "showdown");
    expect(s.result!.pots.map((p) => ({ amount: p.amount, winners: p.winnerIds }))).toEqual([{ amount: 300, winners: ["b"] }, { amount: 200, winners: ["a"] }]);
    expect(s.result!.refunds).toEqual([{ playerId: "a", amount: 100 }]);
    expect(s.players.map((p) => p.chips)).toEqual([300, 300, 0]);
  });
  it("posts short blinds and runs out when only an all-in opponent remains", () => {
    let s = createPoker("m", ["a", "b"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s = actPoker(s, "a", { type: "fold" });
    s.players[0]!.chips = 5; s.players[1]!.chips = 1995;
    s = nextPokerHand(s, freshDeck().reverse());
    expect(s.board).toHaveLength(5); expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(2000);
    expect(s.result!.pots.reduce((n, p) => n + p.amount, 0)).toBe(10);
    expect(s.result!.refunds).toEqual([{ playerId: "b", amount: 5 }]);
  });
  it("ranks equal fixed stacks together and orders same-hand tournament busts by starting chips", () => {
    const s = createPoker("m", ["a", "b", "c"].map((id) => ({ id, name: id })), DEFAULT_POKER_SETTINGS, freshDeck());
    s.players.forEach((p) => { p.chips = 1000; }); expect(pokerStandings(s).map((p) => p.rank)).toEqual([1, 1, 1]);
    s.settings.mode = "tournament";
    s.players[0]!.chips = 3000;
    s.players.slice(1).forEach((p, i) => { p.chips = 0; p.eliminatedAt = 2; p.eliminationChips = 300 - i * 100; });
    expect(pokerStandings(s).map((p) => p.rank)).toEqual([1, 2, 3]);
  });
});
