import { RACING_CAMELS, availableTileSpaces, rankCamels, type CamelState, type CamelCommand, type RacingCamel } from "@catan/game-core/camel-up";
import type { RoomBaseView } from "../platform/room-base.js";
export const CAMEL_NAMES = { blue: "蓝驼", green: "绿驼", yellow: "黄驼", red: "红驼", purple: "紫驼", black: "黑逆驼", white: "白逆驼", grey: "灰骰" } as const;
export interface CamelLegalActions { roll: boolean; tickets: { camel: RacingCamel; value: number }[]; tileSpaces: number[]; finishCards: RacingCamel[]; partners: string[] }
export interface CamelGameView {
  you: { id: string }; id: string; revision: number; leg: number; phase: CamelState["phase"];
  players: CamelState["players"]; stacks: CamelState["stacks"]; remainingDice: CamelState["remainingDice"];
  rolls: CamelState["rolls"]; tiles: CamelState["tiles"]; ranking: RacingCamel[];
  lastRoll: CamelState["lastRoll"]; lastLeg: CamelState["lastLeg"]; log: string[];
  effect: CamelState["effect"];
  ownFinishBets: CamelState["finishBets"]; revealedFinishBets: CamelState["finishBets"] | null;
  finishBetCounts: { winner: number; loser: number };
  ticketSupply: { camel: RacingCamel; value: number | null; remaining: number }[];
  legal: CamelLegalActions;
}
export interface CamelRoomView extends RoomBaseView { gameId: "camel-up"; game: CamelGameView | null }
export interface CamelCommandRequest { seatToken: string; commandId: string; command: CamelCommand }
export interface CamelSettlementV1 { players: { id: string; name: string; coins: number }[]; winnerIds: string[]; ranking: RacingCamel[]; legs: number }
/** Explicit allowlist: no server record or other seat's hidden card can enter a snapshot. */
export function projectCamelUp(state: CamelState, viewerId: string): CamelGameView {
  const active = state.phase.kind === "racing" && state.phase.activePlayerId === viewerId;
  const me = state.players.find(p => p.id === viewerId);
  const supply = RACING_CAMELS.map(camel => {
    const used = state.players.reduce((sum, p) => sum + p.tickets.filter(t => t.camel === camel).length, 0);
    return { camel, value: [5, 3, 2, 2][used] ?? null, remaining: 4 - used };
  });
  const view: CamelGameView = { you: { id: viewerId }, id: state.id, revision: state.revision, leg: state.leg, phase: state.phase,
    players: state.players.map(({ id, name, coins, tickets, pyramidTickets, partnerId }) => ({ id, name, coins,
      tickets: tickets.map(({ camel, value }) => ({ camel, value })), pyramidTickets, partnerId })),
    stacks: state.stacks, remainingDice: state.remainingDice, rolls: state.rolls, tiles: state.tiles,
    ranking: rankCamels(state), lastRoll: state.lastRoll, lastLeg: state.lastLeg, effect: state.effect,
    log: state.log.map(line => line.replace(/\{\{camel:(blue|green|yellow|red|purple|black|white|grey)\}\}/g, (_, key: keyof typeof CAMEL_NAMES) => CAMEL_NAMES[key])),
    ownFinishBets: state.finishBets.filter(b => b.playerId === viewerId), revealedFinishBets: state.phase.kind === "finished" ? state.finishBets : null,
    finishBetCounts: { winner: state.finishBets.filter(b => b.kind === "winner").length, loser: state.finishBets.filter(b => b.kind === "loser").length },
    ticketSupply: supply,
    legal: { roll: active, tickets: active ? supply.flatMap(t => t.value === null ? [] : [{ camel: t.camel, value: t.value }]) : [],
      tileSpaces: active ? availableTileSpaces(state, viewerId) : [],
      finishCards: active ? RACING_CAMELS.filter(c => !state.finishBets.some(b => b.playerId === viewerId && b.camel === c)) : [],
      partners: active && state.players.length >= 6 && !me?.partnerId ? state.players.filter(p => p.id !== viewerId && !p.partnerId).map(p => p.id) : [] } };
  return JSON.parse(JSON.stringify(view)) as CamelGameView;
}
