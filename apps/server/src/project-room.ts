import { getRuleProfileDefinition } from "@catan/game-core";
import { projectGameForPlayer, type RoomView, type TurnTimerView } from "@catan/protocol";
import type { RoomRecord } from "./room-types.js";

export function projectRoomView(room: RoomRecord, viewerId: string, turnTimer: TurnTimerView | null, eventAfterRevision?: number | null): RoomView {
  return {
    id: room.id,
    revision: room.revision,
    hostPlayerId: room.hostPlayerId,
    members: room.members.map((member) => ({
      id: member.id,
      name: member.name,
      color: member.color,
      isHost: member.id === room.hostPlayerId,
    })),
    settings: {
      ruleProfile: room.settings.ruleProfile,
      playerLimit: getRuleProfileDefinition(room.settings.ruleProfile).maxPlayers as 4 | 6,
      victoryPointsToWin: room.settings.victoryPointsToWin,
      mapSeed: room.seed,
      bankCountsPublic: room.settings.bankCountsPublic,
    },
    previewMap: room.game === null
      ? getRuleProfileDefinition(room.settings.ruleProfile).createMap(room.seed)
      : null,
    game: room.game === null
      ? null
      : projectGameForPlayer(room.game, viewerId, room.history, turnTimer, room.settings, room.victoryWarnings, eventAfterRevision),
    setupAnalysis: room.publicSetupAnalysis,
  };
}
