import { pokerLegalActions, pokerStandings, type PokerAction, type PokerSettings, type PokerPhase, type Card, type PokerLegalActions, type PokerState, type HandResult } from "@catan/game-core/texas-holdem";
import type { RoomBaseView } from "../platform/room-base.js";
import type { PokerEvent } from "@catan/game-core/texas-holdem";
export type PokerEffect = PokerEvent & { id: string };
export type { Card, PokerAction, PokerSettings, PokerLegalActions } from "@catan/game-core/texas-holdem";
export { DEFAULT_POKER_SETTINGS, HAND_NAMES, RANKS, SUITS } from "@catan/game-core/texas-holdem";
export interface PokerCommand { matchId: string; handNumber: number; expectedRevision: number; action: PokerAction | { type: "next-hand" } }
export interface PokerCommandRequest { seatToken: string; commandId: string; command: PokerCommand }
export interface PokerSettingsRequest extends PokerSettings { seatToken: string; expectedRevision: number }
export interface PokerDeadline { deadlineAt: number; serverNow: number; durationMs: number }
export interface PokerView {
  id: string; you: { id: string }; revision: number; handNumber: number; phase: PokerPhase; board: Card[];
  players: { id: string; name: string; chips: number; hole: Card[] | null; cardCount: number; folded: boolean; totalBet: number; streetBet: number; eliminated: boolean }[];
  buttonId: string; smallBlindId: string; bigBlindId: string; smallBlind: number; bigBlind: number;
  pot: number; currentBet: number; legal: PokerLegalActions; deadline: PokerDeadline | null; result: HandResult | null;
  standings: ReturnType<typeof pokerStandings>; lastAction: PokerState["lastAction"]; effects: PokerEffect[];
}
export interface PokerRoomView extends RoomBaseView { gameId: "texas-holdem"; settings: PokerSettings; game: PokerView | null }
export interface PokerSettlementV1 { mode: PokerSettings["mode"]; completedHands: number; startingChips: number; standings: ReturnType<typeof pokerStandings> }
export function projectPoker(s: PokerState, viewerId: string, deadline: PokerDeadline | null = null): PokerView {
  // Whitelist the wire shape. Never spread core state or a core player into a projection.
  const revealed = new Set(s.result?.shown.map((p) => p.playerId) ?? []);
  return { id: s.id, you: { id: viewerId }, revision: s.revision, handNumber: s.handNumber, phase: { ...s.phase }, board: [...s.board],
    players: s.players.map((p) => ({ id: p.id, name: p.name, chips: p.chips, hole: p.id === viewerId || revealed.has(p.id) ? [...p.hole] : null, cardCount: p.hole.length, folded: p.folded, totalBet: p.totalBet, streetBet: p.streetBet, eliminated: p.eliminatedAt !== null })),
    buttonId: s.players[s.button]!.id, smallBlindId: s.players[s.smallBlindSeat]!.id, bigBlindId: s.players[s.bigBlindSeat]!.id, smallBlind: s.smallBlind, bigBlind: s.bigBlind,
    pot: s.players.reduce((n, p) => n + p.totalBet, 0), currentBet: s.currentBet, legal: pokerLegalActions(s, viewerId), deadline,
    result: s.result ? { reason: s.result.reason, pots: s.result.pots.map((p) => ({ ...p, eligibleIds: [...p.eligibleIds], winnerIds: [...p.winnerIds], shares: p.shares.map((a) => ({ ...a })) })), refunds: s.result.refunds.map((r) => ({ ...r })), shown: s.result.shown.map((p) => ({ playerId: p.playerId, hole: [...p.hole], rank: { ...p.rank, cards: [...p.rank.cards] } })) } : null,
    standings: pokerStandings(s), lastAction: s.lastAction ? { ...s.lastAction } : null,
    effects: s.events.map((event, i) => {
      const id = `${s.id}:${s.revision}:${i}`;
      switch (event.kind) {
        case "deal": case "showdown": return { id, kind: event.kind, playerIds: [...event.playerIds] };
        case "action": return { id, kind: event.kind, playerId: event.playerId, action: event.action, paid: event.paid, total: event.total };
        case "board": return { id, kind: event.kind, fromIndex: event.fromIndex, count: event.count };
        case "collect": return { id, kind: event.kind, bets: event.bets.map((b) => ({ playerId: b.playerId, amount: b.amount })) };
        case "award": case "refund": return { id, kind: event.kind, playerId: event.playerId, amount: event.amount };
      }
    }) };
}
