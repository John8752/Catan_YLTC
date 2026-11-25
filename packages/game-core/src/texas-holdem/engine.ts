import { validateDeck } from "./cards.js";
import { collectPokerBets, settleHand } from "./settlement.js";
import { requirePoker, validatePokerSettings, type Card, type PokerSettings, type PokerState, type PokerAction, type PokerLegalActions, type Street } from "./types.js";

function copy(s: PokerState): PokerState { return { ...s, events: [], settings: { ...s.settings }, players: s.players.map((p) => ({ ...p, hole: [...p.hole] })), deck: [...s.deck], board: [...s.board] }; }
function nextSeat(s: PokerState, from: number, predicate: (p: PokerState["players"][number]) => boolean): number {
  for (let n = 1; n <= s.players.length; n++) { const i = (from + n) % s.players.length; if (predicate(s.players[i]!)) return i; }
  throw Error("No eligible seat");
}
function draw(s: PokerState): Card { const c = s.deck[s.cursor++]; requirePoker(c, "DECK_EXHAUSTED", "牌堆不足"); return c; }
function pay(s: PokerState, i: number, amount: number) { const p = s.players[i]!, paid = Math.min(p.chips, amount); p.chips -= paid; p.streetBet += paid; p.totalBet += paid; return paid; }
function inHand(p: PokerState["players"][number]) { return p.hole.length > 0 && !p.folded; }
function active(p: PokerState["players"][number]) { return inHand(p) && p.chips > 0; }
function needsAction(s: PokerState, p: PokerState["players"][number]) { return active(p) && (p.lastActedBet === null || p.streetBet < s.currentBet); }

export function pokerLegalActions(s: PokerState, playerId: string): PokerLegalActions {
  const empty: PokerLegalActions = { fold: false, check: false, call: null, minRaiseTo: null, maxRaiseTo: 0, allIn: false };
  if (s.phase.kind !== "betting" || s.phase.actorId !== playerId) return empty;
  const p = s.players.find((p) => p.id === playerId)!;
  const max = p.streetBet + p.chips, debt = Math.max(0, s.currentBet - p.streetBet);
  const reopened = p.lastActedBet === null || p.lastActedBet === 0 || s.currentBet - p.lastActedBet >= s.minRaise;
  const opponent = s.players.some((other) => other.id !== p.id && active(other));
  const canRaise = reopened && opponent && max > s.currentBet;
  return { fold: true, check: debt === 0, call: debt > 0 ? Math.min(debt, p.chips) : null, minRaiseTo: canRaise && max >= s.currentBet + s.minRaise ? s.currentBet + s.minRaise : null, maxRaiseTo: max, allIn: max <= s.currentBet || canRaise };
}
function advance(s: PokerState, after: number) {
  if (s.players.filter(inHand).length === 1) { settleHand(s, "fold"); return; }
  const actors = s.players.filter(active);
  // With only one stack able to act, no phantom blind or empty side-pot bet is due.
  if (actors.length === 1) {
    const lone = actors[0]!;
    const opposingBet = Math.max(0, ...s.players.filter((p) => p.id !== lone.id && inHand(p)).map((p) => p.streetBet));
    s.currentBet = Math.min(s.currentBet, Math.max(lone.streetBet, opposingBet));
  }
  if (actors.length <= 1 && !actors.some((p) => p.streetBet < s.currentBet)) {
    collectPokerBets(s);
    while (s.board.length < 5) reveal(s);
    settleHand(s, "showdown"); return;
  }
  if (s.players.some((p) => needsAction(s, p))) {
    const i = nextSeat(s, after, (p) => needsAction(s, p));
    requirePoker(s.phase.kind === "betting", "INVALID_PHASE", "不在下注阶段");
    s.phase = { ...s.phase, actorId: s.players[i]!.id }; return;
  }
  if (s.board.length === 5) { settleHand(s, "showdown"); return; }
  collectPokerBets(s); reveal(s); s.currentBet = 0; s.minRaise = s.bigBlind;
  s.players.forEach((p) => { p.streetBet = 0; p.lastActedBet = null; });
  const street: Street = s.board.length === 3 ? "flop" : s.board.length === 4 ? "turn" : "river";
  s.phase = { kind: "betting", street, actorId: "" }; advance(s, s.button);
}
function reveal(s: PokerState) { draw(s); const fromIndex = s.board.length, n = fromIndex === 0 ? 3 : 1; for (let i = 0; i < n; i++) s.board.push(draw(s)); s.events.push({ kind: "board", fromIndex, count: n }); }
function deal(s: PokerState, deck: readonly Card[]) {
  validateDeck(deck); s.deck = [...deck]; s.cursor = 0; s.board = []; s.result = null; s.lastAction = null;
  const exponent = s.settings.mode === "tournament" ? Math.floor((s.handNumber - 1) / s.settings.blindInterval) : 0;
  s.smallBlind = Math.min(s.totalChips, s.settings.smallBlind * 2 ** Math.min(30, exponent)); s.bigBlind = Math.min(s.totalChips, s.smallBlind * 2);
  const live = s.players.filter((p) => p.chips > 0);
  s.players.forEach((p) => { p.hole = []; p.folded = p.chips === 0; p.totalBet = 0; p.streetBet = 0; p.lastActedBet = null; p.startChips = p.chips; });
  const eligible = (p: PokerState["players"][number]) => p.chips > 0;
  s.smallBlindSeat = live.length === 2 ? s.button : nextSeat(s, s.button, eligible);
  s.bigBlindSeat = nextSeat(s, s.smallBlindSeat, eligible);
  let seat = s.smallBlindSeat;
  for (let n = 0; n < live.length * 2; n++) { s.players[seat]!.hole.push(draw(s)); seat = nextSeat(s, seat, eligible); }
  s.events.push({ kind: "deal", playerIds: live.map((p) => p.id) });
  const smallPaid = pay(s, s.smallBlindSeat, s.smallBlind), bigPaid = pay(s, s.bigBlindSeat, s.bigBlind);
  s.events.push({ kind: "action", playerId: s.players[s.smallBlindSeat]!.id, action: "blind", paid: smallPaid, total: smallPaid }, { kind: "action", playerId: s.players[s.bigBlindSeat]!.id, action: "blind", paid: bigPaid, total: bigPaid });
  s.currentBet = s.bigBlind; s.minRaise = s.bigBlind;
  s.phase = { kind: "betting", street: "preflop", actorId: "" }; advance(s, s.bigBlindSeat);
}
export function createPoker(id: string, players: readonly { id: string; name: string }[], settings: PokerSettings, deck: readonly Card[]): PokerState {
  validatePokerSettings(settings);
  requirePoker(players.length >= 2 && players.length <= 9 && new Set(players.map((p) => p.id)).size === players.length, "INVALID_PLAYERS", "德州扑克需要 2–9 位不同玩家");
  const s: PokerState = { id, revision: 1, settings: { ...settings }, players: players.map((p) => ({ ...p, chips: settings.startingChips, hole: [], folded: false, totalBet: 0, streetBet: 0, lastActedBet: null, startChips: settings.startingChips, eliminatedAt: null, eliminationChips: 0 })), totalChips: players.length * settings.startingChips,
    handNumber: 1, button: 0, smallBlindSeat: 0, bigBlindSeat: 0, smallBlind: 0, bigBlind: 0, deck: [], cursor: 0, board: [], currentBet: 0, minRaise: 0, phase: { kind: "hand-over" }, result: null, lastAction: null, events: [] };
  deal(s, deck); return s;
}
export function nextPokerHand(state: PokerState, deck: readonly Card[]): PokerState {
  requirePoker(state.phase.kind === "hand-over", "INVALID_PHASE", "当前不能发下一手");
  const s = copy(state); s.revision++; s.handNumber++;
  s.button = nextSeat(s, s.button, (p) => p.chips > 0); deal(s, deck); return s;
}
export function actPoker(state: PokerState, playerId: string, action: PokerAction): PokerState {
  requirePoker(state.phase.kind === "betting" && state.phase.actorId === playerId, "NOT_YOUR_TURN", "尚未轮到你行动");
  const legal = pokerLegalActions(state, playerId), s = copy(state), i = s.players.findIndex((p) => p.id === playerId), p = s.players[i]!;
  let paid = 0;
  switch (action.type) {
    case "fold": p.folded = true; break;
    case "check": requirePoker(legal.check, "CANNOT_CHECK", "需要跟注或弃牌"); break;
    case "call": requirePoker(legal.call !== null, "CANNOT_CALL", "当前无需跟注"); paid = pay(s, i, legal.call); break;
    case "raise":
    case "all-in": {
      const to = action.type === "raise" ? action.to : legal.maxRaiseTo;
      requirePoker(Number.isSafeInteger(to) && to > p.streetBet && to <= legal.maxRaiseTo, "INVALID_RAISE", "加注总额超出范围");
      if (to <= s.currentBet) requirePoker(action.type === "all-in" && legal.allIn, "INVALID_RAISE", "加注必须超过当前下注");
      else requirePoker((action.type !== "all-in" || legal.allIn) && (legal.minRaiseTo !== null && to >= legal.minRaiseTo || to === legal.maxRaiseTo && legal.allIn), "RAISE_NOT_REOPENED", "未达到最小加注或尚未重新开放加注");
      paid = pay(s, i, to - p.streetBet);
      if (to > s.currentBet) { const increase = to - s.currentBet; if (increase >= s.minRaise) s.minRaise = increase; s.currentBet = to; }
      break;
    }
    default: throw Error("Unknown poker action");
  }
  p.lastActedBet = s.currentBet; s.revision++; s.lastAction = { playerId, type: action.type, paid };
  s.events.push({ kind: "action", playerId, action: action.type, paid, total: p.streetBet }); advance(s, i); return s;
}
