import type { GameEvent, GameState } from "@catan/game-core";
import { CATAN_GAME_ID, projectGameSummary, type CatanSettlementV1, type MatchRecord } from "@catan/protocol";
import type { MatchParticipant } from "./database/match-repository.js";
import type { RoomRecord } from "./room-types.js";

export function prepareSettlement(room: RoomRecord, state: GameState, events: readonly GameEvent[], finishedAt: number):
  { record: MatchRecord<CatanSettlementV1>; participants: MatchParticipant[] } | null {
  if (state.phase.kind !== "finished" || room.game?.phase.kind === "finished") return null;
  const summary = projectGameSummary(state, [...room.history, ...events.map((event) => ({ revision: state.revision, event }))]);
  if (!summary) return null;
  return {
    record: { gameId: CATAN_GAME_ID, matchId: room.matchId, dataVersion: 1, startedAt: room.startedAt, finishedAt,
      data: { ruleProfile: room.settings.ruleProfile, victoryPointsToWin: state.victoryPointsToWin, winnerId: state.phase.winnerId,
        players: room.members.map(({ id, name, color }) => ({ id, name, color })), summary } },
    participants: room.members.flatMap((member) => member.accountId === null ? [] : [{ accountId: member.accountId, playerId: member.id }]),
  };
}
