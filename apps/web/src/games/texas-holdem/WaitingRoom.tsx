import { useState } from "react";
import { POKER_PLAYER_LIMITS } from "@catan/game-core/texas-holdem";
import type { PokerRoomView } from "@catan/protocol/texas-holdem";
import { RoomLobby, changeWaitingRoom, type WaitingProps } from "../../components/lobby/RoomLobby.js";
import { WorldPreview } from "../../components/lobby/WorldPreview.js";
import { shuffleRoomMembers } from "../../api.js";
import { PokerLobby } from "./PokerLobby.js";
import { savePokerSettings } from "./api.js";

export function PokerWaitingRoom(props: WaitingProps<PokerRoomView>) {
  const { room, session } = props, [dirty, setDirty] = useState(false), shuffle = () => changeWaitingRoom(props, () => shuffleRoomMembers(session, room.revision));
  return <RoomLobby {...props} settingsHint="修改后请保存，保存后同步给所有人" minPlayers={POKER_PLAYER_LIMITS.min} capacity={POKER_PLAYER_LIMITS.max} summary={`${room.settings.mode === "tournament" ? "锦标赛" : `固定 ${room.settings.handLimit} 手`} · 初始 ${room.settings.startingChips} 筹码`} startLabel="开始德州扑克" settingsDirty={dirty}
    preview={<WorldPreview gameId="texas-holdem" seated={room.members.length} capacity={POKER_PLAYER_LIMITS.max} className="h-[300px] sm:h-[430px] lg:h-[min(40vh,390px)]" />}
    onShuffle={shuffle}
    settings={<div className="[&>section]:space-y-4 [&>section]:bg-transparent [&>section]:p-0"><PokerLobby room={room} host={room.hostPlayerId === session.playerId} busy={props.busy || props.connectionState !== "live"} onSettings={(settings) => changeWaitingRoom(props, () => savePokerSettings(session, room.revision, settings))} onStart={props.handleStart} onShuffle={shuffle} settingsOnly onDirtyChange={setDirty} /></div>}
  />;
}
