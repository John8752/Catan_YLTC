import { evaluateHand } from "./cards.js";
import { requirePoker, type PokerState, type HandResult } from "./types.js";

/** Mutates only an engine-owned copy. No hidden cards leave core through these helpers. */
export function collectPokerBets(s: PokerState) {
  const bets = s.players.filter((p) => p.streetBet > 0).map((p) => ({ playerId: p.id, amount: p.streetBet }));
  if (bets.length) s.events.push({ kind: "collect", bets });
  s.players.forEach((p) => { p.streetBet = 0; });
}
export function settleHand(s: PokerState, reason: HandResult["reason"]) {
  collectPokerBets(s);
  const live = s.players.filter((p) => p.hole.length && !p.folded);
  const shown = reason === "showdown" ? live.map((p) => ({ playerId: p.id, hole: [...p.hole], rank: evaluateHand([...p.hole, ...s.board]) })) : [];
  if (shown.length) s.events.push({ kind: "showdown", playerIds: shown.map((p) => p.playerId) });
  const result: HandResult = { reason, pots: [], refunds: [], shown };
  const levels = [...new Set(s.players.map((p) => p.totalBet).filter(Boolean))].sort((a, b) => a - b);
  let previous = 0;
  for (const level of levels) {
    const contributors = s.players.filter((p) => p.totalBet >= level);
    const amount = (level - previous) * contributors.length; previous = level;
    if (contributors.length === 1) {
      const p = contributors[0]!; p.chips += amount; result.refunds.push({ playerId: p.id, amount }); s.events.push({ kind: "refund", playerId: p.id, amount }); continue;
    }
    const eligible = contributors.filter((p) => !p.folded && p.hole.length);
    requirePoker(eligible.length, "INVALID_POT", "底池没有可获胜玩家");
    const best = reason === "fold" ? 0 : Math.max(...eligible.map((p) => shown.find((r) => r.playerId === p.id)!.rank.value));
    const winners = eligible.filter((p) => reason === "fold" || shown.find((r) => r.playerId === p.id)!.rank.value === best)
      .sort((a, b) => (s.players.indexOf(a) - s.button - 1 + s.players.length) % s.players.length - (s.players.indexOf(b) - s.button - 1 + s.players.length) % s.players.length);
    const shares = winners.map((p, i) => ({ playerId: p.id, amount: Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0) }));
    shares.forEach((share) => { s.players.find((p) => p.id === share.playerId)!.chips += share.amount; s.events.push({ kind: "award", playerId: share.playerId, amount: share.amount }); });
    result.pots.push({ amount, eligibleIds: eligible.map((p) => p.id), winnerIds: winners.map((p) => p.id), shares });
  }
  for (const p of s.players) {
    if (p.chips === 0 && p.eliminatedAt === null) { p.eliminatedAt = s.handNumber; p.eliminationChips = p.startChips; }
    p.totalBet = 0; p.streetBet = 0;
  }
  requirePoker(s.players.reduce((n, p) => n + p.chips, 0) === s.totalChips, "CHIP_INVARIANT", "筹码总量异常");
  s.result = result;
  const finished = s.players.filter((p) => p.chips > 0).length <= 1 || (s.settings.mode === "fixed-hands" && s.handNumber >= s.settings.handLimit);
  s.phase = { kind: finished ? "finished" : "hand-over" };
}
export function pokerStandings(s: PokerState): { playerId: string; name: string; chips: number; rank: number }[] {
  const score = (p: PokerState["players"][number]) => s.settings.mode === "fixed-hands" || p.chips > 0 ? [1, p.chips, 0] : [0, p.eliminatedAt ?? 0, p.eliminationChips];
  const compare = (a: PokerState["players"][number], b: PokerState["players"][number]) => { const x = score(a), y = score(b); return y[0]! - x[0]! || y[1]! - x[1]! || y[2]! - x[2]!; };
  const sorted = [...s.players].sort(compare);
  return sorted.map((p) => ({ playerId: p.id, name: p.name, chips: p.chips, rank: 1 + sorted.filter((other) => compare(other, p) < 0).length }));
}
