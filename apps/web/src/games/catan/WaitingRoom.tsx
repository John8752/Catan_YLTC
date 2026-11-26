import type { RoomView } from "@catan/protocol/catan";
import { getRuleProfileDefinition } from "@catan/game-core/catan";
import { RoomLobby, changeWaitingRoom, type WaitingProps } from "../../components/lobby/RoomLobby.js";
import { shuffleRoomMembers, updatePlayerColor } from "../../api.js";
import { updateRoomSettings, rerollRoomMap } from "./api.js";
import { LobbySetup } from "./components/LobbySetup.js";
import { RoomSettingsFields } from "./components/RoomSettingsFields.js";
import { PlayerColorPicker } from "./components/PlayerColorPicker.js";
import { PlayerSettlementIcon } from "./components/PlayerSettlementIcon.js";

export function CatanWaitingRoom(props: WaitingProps<RoomView>) {
  const { room, session } = props, host = room.hostPlayerId === session.playerId, profile = getRuleProfileDefinition(room.settings.ruleProfile);
  const own = room.members.find(m => m.id === session.playerId)!;
  return <RoomLobby {...props} settingsHint="房主调整后，设置会同步给所有人" minPlayers={profile.minPlayers} capacity={profile.maxPlayers} summary={`${room.settings.playerLimit} 人上限 · ${room.settings.victoryPointsToWin} 分获胜 · ${room.previewMap?.hexes.length ?? 0} 块地形`} startLabel="使用当前地图开局"
    memberAvatar={(member) => <PlayerSettlementIcon color={member.color} className="size-9 shrink-0" label={`${member.name}的村庄颜色`} />}
    onShuffle={() => changeWaitingRoom(props, () => shuffleRoomMembers(session, room.revision))}
    preview={<div className="mt-5 [&_.board-heading]:px-0 [&_.board-heading_h2]:text-base [&_.board-heading_p]:text-xs [&_.board-shell]:h-auto [&_.board-stage]:mt-3 [&_.board-stage]:h-[340px] [&_.board-stage]:flex-none sm:[&_.board-stage]:h-[440px] lg:[&_.board-stage]:h-[min(47vh,540px)] [&_.board-instruction]:text-xs"><LobbySetup contained room={room} isHost={host} busy={props.busy || props.connectionState !== "live"} onReroll={() => void changeWaitingRoom(props, () => rerollRoomMap(session, room.revision))} /></div>}
    settings={<RoomSettingsFields room={room} isHost={host} busy={props.busy || props.connectionState !== "live"} onSettingsChange={(settings) => void changeWaitingRoom(props, () => updateRoomSettings(session, room.revision, settings))} />}
    colorControl={<div className="flex items-center justify-between text-sm"><span>我的村庄颜色</span><PlayerColorPicker currentColor={own.color} members={room.members} busy={props.busy || props.connectionState !== "live"} onChange={(color) => void changeWaitingRoom(props, () => updatePlayerColor(session, room.revision, color))} /></div>}
  />;
}
