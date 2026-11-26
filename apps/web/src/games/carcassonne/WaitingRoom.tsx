import { CARCASSONNE_PLAYER_LIMITS } from "@catan/game-core/carcassonne";
import { PLAYER_COLORS } from "@catan/game-core/primitives";
import type { CarcassonneRoomView } from "@catan/protocol/carcassonne";
import { RoomLobby, changeWaitingRoom, type WaitingProps } from "../../components/lobby/RoomLobby.js";
import { WorldPreview } from "../../components/lobby/WorldPreview.js";
import { shuffleRoomMembers, updatePlayerColor } from "../../api.js";
import { PLAYER_COLOR_LABELS, PLAYER_SVG_COLORS } from "../../lib/player-palette.js";
import { Button } from "../../components/ui/button.js";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog.js";
import { MeepleArt } from "./TileArt.js";

export function CarcassonneWaitingRoom(props: WaitingProps<CarcassonneRoomView>) {
  const { room, session } = props, own = room.members.find(m => m.id === session.playerId)!;
  return <RoomLobby {...props} settingsHint="本局使用基础版固定规则" minPlayers={CARCASSONNE_PLAYER_LIMITS.min} capacity={CARCASSONNE_PLAYER_LIMITS.max} summary="基础版 · 72 块地形 · 含农夫" startLabel="开始拼城"
    preview={<WorldPreview gameId="carcassonne" seated={room.members.length} capacity={CARCASSONNE_PLAYER_LIMITS.max} className="h-[300px] sm:h-[430px] lg:h-[min(40vh,390px)]" />}
    onShuffle={() => changeWaitingRoom(props, () => shuffleRoomMembers(session, room.revision))}
    settings={<div className="space-y-4 text-sm leading-6 text-[#566354]"><p>每人 7 名随从，轮流接上地形，选择是否派出随从，再确认落子。</p><p>城镇、道路、修道院完成后计分；农夫留在田野，终局统一结算。</p><p>桌上展示为玩法场景；正式开局后，从本局起始板块开始拼接。</p></div>}
    colorControl={<Dialog><DialogTrigger asChild><Button variant="outline" className="min-h-11 w-full">选择我的随从颜色</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>选择随从颜色</DialogTitle><DialogDescription>已被其他玩家选中的颜色不可重复使用。</DialogDescription></DialogHeader><div className="grid grid-cols-3 gap-2">{PLAYER_COLORS.map(color => <Button key={color} variant="outline" className="h-auto min-h-20 flex-col gap-2" aria-pressed={own.color === color} disabled={props.busy || props.connectionState !== "live" || room.members.some(m => m.id !== own.id && m.color === color)} onClick={() => void changeWaitingRoom(props, () => updatePlayerColor(session, room.revision, color))}><svg className="size-7 overflow-visible" viewBox="-16 -18 32 36" aria-hidden="true"><MeepleArt color={PLAYER_SVG_COLORS[color]} /></svg>{PLAYER_COLOR_LABELS[color]}{own.color === color && " · 已选"}</Button>)}</div></DialogContent></Dialog>}
  />;
}
