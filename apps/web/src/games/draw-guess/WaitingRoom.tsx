import { DRAW_GUESS_PLAYER_LIMITS } from "@catan/game-core/draw-guess";
import type { DrawGuessRoomView } from "@catan/protocol/draw-guess";
import { RoomLobby, changeWaitingRoom, type WaitingProps } from "../../components/lobby/RoomLobby.js";
import { PaperPreview } from "../../components/lobby/PaperPreview.js";
import { shuffleRoomMembers } from "../../api.js";
import { DrawLobbySettings } from "./LobbySettings.js";
import { saveDrawSettings } from "./api.js";

export function DrawWaitingRoom(props: WaitingProps<DrawGuessRoomView>) {
  const { room, session } = props;
  return <RoomLobby {...props} settingsHint="房主调整后，设置会同步给所有人" minPlayers={DRAW_GUESS_PLAYER_LIMITS.min} capacity={DRAW_GUESS_PLAYER_LIMITS.max} summary={`猜词 ${room.settings.textSeconds} 秒 · 画画 ${room.settings.drawingSeconds} 秒`} startLabel="开始传画猜词" preview={<PaperPreview />}
    onShuffle={() => changeWaitingRoom(props, () => shuffleRoomMembers(session, room.revision))}
    settings={<DrawLobbySettings room={room} host={room.hostPlayerId === session.playerId} busy={props.busy || props.connectionState !== "live"} onChange={(settings) => void changeWaitingRoom(props, () => saveDrawSettings(session, room.revision, settings))} />}
  />;
}
