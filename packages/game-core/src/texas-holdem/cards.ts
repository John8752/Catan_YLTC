import { RANKS, SUITS, requirePoker, type Card, type HandRank } from "./types.js";
export function freshDeck(): Card[] { return SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}` as Card)); }
export function validateDeck(deck: readonly Card[]) {
  const allowed = new Set(freshDeck());
  requirePoker(deck.length === 52 && new Set(deck).size === 52 && deck.every((c) => allowed.has(c)), "INVALID_DECK", "需要完整无重复的 52 张牌");
}
function five(cards: Card[]): HandRank {
  const ranks = cards.map((c) => RANKS.indexOf(c[0] as typeof RANKS[number]) + 2).sort((a, b) => b - a);
  const counts = new Map<number, number>(); ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((c) => c[1] === cards[0]![1]);
  const distinct = [...new Set(ranks)];
  const straight = distinct.length === 5 ? distinct[0]! - distinct[4]! === 4 ? distinct[0]! : distinct.join() === "14,5,4,3,2" ? 5 : 0 : 0;
  let category = 0, kickers = ranks;
  if (flush && straight) { category = 8; kickers = [straight]; }
  else if (groups[0]![1] === 4) { category = 7; kickers = groups.map(([r]) => r); }
  else if (groups[0]![1] === 3 && groups[1]![1] === 2) { category = 6; kickers = groups.map(([r]) => r); }
  else if (flush) category = 5;
  else if (straight) { category = 4; kickers = [straight]; }
  else if (groups[0]![1] === 3) { category = 3; kickers = groups.map(([r]) => r); }
  else if (groups[0]![1] === 2 && groups[1]![1] === 2) { category = 2; kickers = groups.map(([r]) => r); }
  else if (groups[0]![1] === 2) { category = 1; kickers = groups.map(([r]) => r); }
  const value = [category, ...Array.from({ length: 5 }, (_, i) => kickers[i] ?? 0)].reduce((n, r) => n * 15 + r, 0);
  return { category, value, cards };
}
export function evaluateHand(cards: readonly Card[]): HandRank {
  requirePoker(cards.length >= 5 && cards.length <= 7 && new Set(cards).size === cards.length && cards.every((c) => freshDeck().includes(c)), "INVALID_HAND", "牌型需要 5–7 张不重复的牌");
  let best: HandRank | null = null;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++) for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++) for (let e = d + 1; e < cards.length; e++) {
    const rank = five([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
    if (!best || rank.value > best.value) best = rank;
  }
  return best!;
}
