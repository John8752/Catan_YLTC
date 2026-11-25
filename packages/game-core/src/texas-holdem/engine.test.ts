import { describe, expect, it } from "vitest";
import { createPoker, actPoker, nextPokerHand, DEFAULT_POKER_SETTINGS, freshDeck, evaluateHand, type PokerState, type PokerAction } from "./index.js";

const players = ["a", "b", "c"].map((id) => ({ id, name: id }));
const settings = { ...DEFAULT_POKER_SETTINGS, handLimit: 2 };
function start(count = 3, overrides = {}) { return createPoker("match", players.slice(0, count), { ...settings, ...overrides }, freshDeck()); }
function act(s: PokerState, action: PokerAction) { if (s.phase.kind !== "betting") throw Error("not betting"); return actPoker(s, s.phase.actorId, action); }
function passive(s: PokerState) { const phase = s.phase; return act(s, { type: phase.kind === "betting" && s.players.find((p) => p.id === phase.actorId)!.streetBet < s.currentBet ? "call" : "check" }); }

describe("texas-holdem deterministic rules", () => {
  it("deals unique cards and posts blinds, with big blind option", () => {
    let s = start();
    expect(s.players.map((p) => p.chips)).toEqual([1000, 990, 980]);
    expect(s.phase).toMatchObject({ kind: "betting", actorId: "a", street: "preflop" });
    s = passive(passive(s));
    expect(s.phase).toMatchObject({ actorId: "c", street: "preflop" });
    s = passive(s);
    expect(s.board).toEqual(["9S", "TS", "JS"]);
    expect(s.phase).toMatchObject({ actorId: "b", street: "flop" });
    expect(createPoker("match", players, settings, freshDeck())).toEqual(start());
  });
  it("handles heads-up position and rejects out of turn / illegal checks without mutation", () => {
    const s = start(2), before = JSON.stringify(s);
    expect(s.phase).toMatchObject({ actorId: "a" });
    expect(() => actPoker(s, "b", { type: "fold" })).toThrow();
    expect(() => act(s, { type: "check" })).toThrow();
    expect(() => act(s, { type: "raise", to: 21 })).toThrow();
    expect(JSON.stringify(s)).toBe(before);
    expect(passive(passive(s)).phase).toMatchObject({ actorId: "b", street: "flop" });
  });
  it("settles a fold, conserves chips, rotates positions and ends fixed hands", () => {
    let s = act(start(2), { type: "fold" });
    expect(s.phase.kind).toBe("hand-over");
    expect(s.players.map((p) => p.chips)).toEqual([990, 1010]);
    s = nextPokerHand(s, freshDeck().reverse());
    expect(s.handNumber).toBe(2);
    expect(s.button).toBe(1);
    s = act(s, { type: "fold" });
    expect(s.phase.kind).toBe("finished");
    expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(2000);
  });
  it("runs all-in to showdown and awards distinct side pots with unmatched refund", () => {
    let s = start();
    s = { ...s, players: s.players.map((p, i) => ({ ...p, chips: [300, 100, 200][i]! - p.totalBet, startChips: [300, 100, 200][i]! })), totalChips: 600 };
    s = act(s, { type: "all-in" }); s = act(s, { type: "all-in" }); s = act(s, { type: "all-in" });
    expect(["hand-over", "finished"]).toContain(s.phase.kind);
    expect(s.board).toHaveLength(5);
    expect(s.result!.pots.map((p) => p.amount)).toEqual([300, 200]);
    expect(s.result!.refunds).toEqual([{ playerId: "a", amount: 100 }]);
    expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(600);
  });
  it("does not reopen a short all-in, but does reopen cumulative full raises", () => {
    let s = start();
    s = act(s, { type: "raise", to: 100 });
    s = { ...s, players: s.players.map((p) => p.id === "b" ? { ...p, chips: 110 } : p) };
    s = act(s, { type: "all-in" }); s = act(s, { type: "call" });
    expect(() => act(s, { type: "raise", to: 200 })).toThrow();
    s = act(s, { type: "call" });
    expect(s.phase).toMatchObject({ street: "flop" });
  });
  it("compares all kickers, wheel, full house, flush and board ties", () => {
    expect(evaluateHand(["AS", "2D", "3H", "4C", "5S", "KD", "QC"]).category).toBe(4);
    expect(evaluateHand(["AS", "KS", "QS", "JS", "TS", "2D", "3C"]).category).toBe(8);
    expect(evaluateHand(["AS", "AD", "AH", "KC", "KS", "KD", "2C"]).category).toBe(6);
    expect(evaluateHand(["AS", "AD", "KH", "QC", "JS", "9D", "2C"]).value).toBeGreaterThan(evaluateHand(["AS", "AD", "KH", "QC", "TS", "9D", "2C"]).value);
  });
  it("raises tournament blinds on the configured interval and ends on elimination", () => {
    let s = start(2, { mode: "tournament", blindInterval: 1 });
    s = act(s, { type: "fold" }); s = nextPokerHand(s, freshDeck().reverse());
    expect(s.bigBlind).toBe(40);
    expect(s.smallBlind).toBe(20);
  });
  it("rejects malformed decks and invalid settings", () => {
    expect(() => createPoker("m", players, settings, Array(52).fill("AS"))).toThrow();
    expect(() => start(2, { smallBlind: 0 })).toThrow();
    expect(() => start(2, { handLimit: Infinity })).toThrow();
    expect(() => start(2, { startingChips: 1.5 })).toThrow();
  });
});
