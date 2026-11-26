import type { RoomView } from "../catan/views.js";
import type { RoomBaseView } from "./room-base.js";
export type { RoomBaseView, LobbyMemberView } from "./room-base.js";
import type { PokerRoomView } from "../texas-holdem/index.js";
import type { DrawGuessRoomView } from "../draw-guess/index.js";
import type { CamelRoomView } from "../camel-up/index.js";
import type { CarcassonneRoomView } from "../carcassonne/index.js";

export const GAME_IDS = ["catan", "draw-guess", "camel-up", "carcassonne", "texas-holdem"] as const;
export const DEFAULT_GAME_ID = GAME_IDS[0];
export type GameType = (typeof GAME_IDS)[number];
export const GAME_CATALOG = [
  { id: "catan", name: "卡坦", players: "2–6 人", description: "造路建城、交换资源，一起经营海岛。", createLabel:"创建今晚的岛", historyLabel:"卡坦岛对局记录", settlementVersion:1 },
  { id: "draw-guess", name: "传画猜词", players: "3–6 人", description: "你画我猜接力，最后一起看词语怎么越传越离谱。", createLabel:"创建传画猜词房间", historyLabel:"传画猜词对局记录", settlementVersion:1 },
  { id: "camel-up", name: "骆驼大赛", players: "3–6 人", description: "摇骰叠骆驼、押注抢先机，在沙漠赛场赢得最多金币。", createLabel:"创建骆驼大赛房间", historyLabel:"骆驼大赛对局记录", settlementVersion:1 },
  { id: "carcassonne", name: "卡卡颂", players: "2–5 人", description: "拼接城镇与田野，派出随从，合力铺出各有算盘的风景。", createLabel:"创建卡卡颂房间", historyLabel:"卡卡颂对局记录", settlementVersion:1 },
  { id: "texas-holdem", name: "德州扑克", players: "2–9 人", description: "固定手数或锦标赛，虚拟筹码，和朋友一起比牌。", createLabel:"创建德州扑克房间", historyLabel:"德州扑克对局记录", settlementVersion:1 },
] as const satisfies readonly { readonly id: GameType; readonly name: string; readonly players: string; readonly description: string; readonly createLabel:string; readonly historyLabel:string; readonly settlementVersion:number }[];

export function isGameType(value:unknown):value is GameType { return typeof value==="string"&&GAME_IDS.some(id=>id===value); }
export function getGameDefinition(gameId:GameType){
  const definition=GAME_CATALOG.find(game=>game.id===gameId);
  if(!definition)throw new Error("未注册的游戏");
  return definition;
}
/** A missing explicit case is a type error; unknown runtime IDs never select a game. */
export function unregisteredGame(_value:never):never { throw new Error("未注册的游戏"); }

export type AnyRoomView = RoomView | DrawGuessRoomView | CamelRoomView | CarcassonneRoomView | PokerRoomView;
export interface RoomSession<R extends RoomBaseView = AnyRoomView> {
  readonly roomId: string;
  readonly playerId: string;
  readonly seatToken: string;
  readonly room: R;
}
export type AnyRoomServerMessage =
  | { readonly type: "room_state"; readonly room: AnyRoomView }
  | { readonly type: "room_closed"; readonly message: string }
  | { readonly type: "account_session_replaced"; readonly message: string }
  | { readonly type: "error"; readonly code: string; readonly message: string };

export * from "./accounts.js";
export * from "./messages.js";
export type { RoomCommandAck } from "./command-ack.js";
