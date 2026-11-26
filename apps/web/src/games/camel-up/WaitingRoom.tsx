import { CAMEL_UP_PLAYER_LIMITS } from "@catan/game-core/camel-up";
import type { CamelRoomView } from "@catan/protocol/camel-up";
import { RoomLobby, changeWaitingRoom, type WaitingProps } from "../../components/lobby/RoomLobby.js";
import { WorldPreview } from "../../components/lobby/WorldPreview.js";
import { shuffleRoomMembers } from "../../api.js";

export function CamelWaitingRoom(props: WaitingProps<CamelRoomView>) {
  const { room, session } = props;
  return <RoomLobby {...props} settingsHint="本局使用固定规则" minPlayers={CAMEL_UP_PLAYER_LIMITS.min} capacity={CAMEL_UP_PLAYER_LIMITS.max} summary="每人 3 金币起步 · 最多金币获胜" startLabel="开始骆驼大赛"
    preview={<WorldPreview gameId="camel-up" seated={room.members.length} capacity={CAMEL_UP_PLAYER_LIMITS.max} className="h-[300px] sm:h-[430px] lg:h-[min(40vh,390px)]" />}
    onShuffle={() => changeWaitingRoom(props, () => shuffleRoomMembers(session, room.revision))}
    settings={<div className="space-y-4 text-sm leading-6 text-[#566354]"><p>五只赛骆驼，全桌都能押。骆驼叠在一起跑，逆行骆驼还能改变局势。</p><p>轮到你时选择一个行动：拿赛段票、放观众牌、摇骰，或预测整场冠军与末名。</p><p>六人局启用合伙；终局预测仅自己可见，比赛结束统一揭晓。</p></div>}
  />;
}
