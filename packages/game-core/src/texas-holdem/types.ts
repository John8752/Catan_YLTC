export const POKER_PLAYER_LIMITS = { min: 2, max: 9 } as const;
export const SUITS = ["S", "H", "D", "C"] as const;
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export type Card = `${typeof RANKS[number]}${typeof SUITS[number]}`;
export type PokerMode = "fixed-hands" | "tournament";
export interface PokerSettings {
  mode: PokerMode; startingChips: number; smallBlind: number; handLimit: number; blindInterval: number; actionSeconds: 15 | 30 | 60;
}
export const DEFAULT_POKER_SETTINGS: PokerSettings = { mode: "fixed-hands", startingChips: 1000, smallBlind: 10, handLimit: 10, blindInterval: 5, actionSeconds: 30 };
export type PokerAction = { type: "fold" | "check" | "call" | "all-in" } | { type: "raise"; to: number };
export type Street = "preflop" | "flop" | "turn" | "river";
export type PokerPhase = { kind: "betting"; street: Street; actorId: string } | { kind: "hand-over" } | { kind: "finished" };
export interface PokerPlayer {
  id: string; name: string; chips: number; hole: Card[]; folded: boolean; totalBet: number; streetBet: number;
  lastActedBet: number | null; startChips: number; eliminatedAt: number | null; eliminationChips: number;
}
export interface HandRank { category: number; value: number; cards: Card[] }
export const HAND_NAMES = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"] as const;
export interface PotAward { amount: number; eligibleIds: string[]; winnerIds: string[]; shares: { playerId: string; amount: number }[] }
export interface HandResult {
  reason: "fold" | "showdown"; pots: PotAward[]; refunds: { playerId: string; amount: number }[];
  shown: { playerId: string; hole: Card[]; rank: HandRank }[];
}
/** Latest deterministic transition only; never includes hole cards, burns or deck order. */
export type PokerEvent =
  | { kind: "deal"; playerIds: string[] }
  | { kind: "action"; playerId: string; action: PokerAction["type"] | "blind"; paid: number; total: number }
  | { kind: "board"; fromIndex: number; count: number }
  | { kind: "collect"; bets: { playerId: string; amount: number }[] }
  | { kind: "showdown"; playerIds: string[] }
  | { kind: "award" | "refund"; playerId: string; amount: number };
export interface PokerState {
  id: string; revision: number; settings: PokerSettings; players: PokerPlayer[]; totalChips: number;
  handNumber: number; button: number; smallBlindSeat: number; bigBlindSeat: number; smallBlind: number; bigBlind: number;
  deck: Card[]; cursor: number; board: Card[]; currentBet: number; minRaise: number; phase: PokerPhase; result: HandResult | null;
  lastAction: { playerId: string; type: PokerAction["type"]; paid: number } | null; events: PokerEvent[];
}
export interface PokerLegalActions { fold: boolean; check: boolean; call: number | null; minRaiseTo: number | null; maxRaiseTo: number; allIn: boolean }
export class PokerError extends Error { constructor(public readonly code: string, message: string) { super(message); } }
export function requirePoker(condition: unknown, code: string, message: string): asserts condition { if (!condition) throw new PokerError(code, message); }
export function validatePokerSettings(s: PokerSettings) {
  const integer = (n: number, min: number, max: number) => Number.isSafeInteger(n) && n >= min && n <= max;
  requirePoker((s.mode === "fixed-hands" || s.mode === "tournament") && integer(s.startingChips, 100, 100000) && integer(s.smallBlind, 1, 1000) && s.smallBlind * 2 <= s.startingChips && integer(s.handLimit, 1, 100) && integer(s.blindInterval, 1, 50) && [15, 30, 60].includes(s.actionSeconds), "INVALID_SETTINGS", "请检查筹码、盲注和手数设置");
}
