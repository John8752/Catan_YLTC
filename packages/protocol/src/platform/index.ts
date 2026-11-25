import type { RoomView } from "../catan/views.js";
import type { RoomBaseView } from "./room-base.js";
export type { RoomBaseView, LobbyMemberView } from "./room-base.js";
import type { DrawGuessRoomView } from "../draw-guess/index.js";
import type { CamelRoomView } from "../camel-up/index.js";
import type { CarcassonneRoomView } from "../carcassonne/index.js";

export const GAME_IDS = ["catan", "draw-guess", "camel-up", "carcassonne"] as const;
export const DEFAULT_GAME_ID = GAME_IDS[0];
export type GameType = (typeof GAME_IDS)[number];
export const GAME_CATALOG = [
  { id: "catan", name: "卡坦", players: "2–6 人", description: "造路建城、交换资源，一起经营海岛。" },
  { id: "draw-guess", name: "传画猜词", players: "3–6 人", description: "你画我猜接力，最后一起看词语怎么越传越离谱。" },
  { id: "camel-up", name: "骆驼大赛", players: "3–6 人", description: "摇骰叠骆驼、押注抢先机，在沙漠赛场赢得最多金币。" },
  { id: "carcassonne", name: "卡卡颂", players: "2–5 人", description: "拼接城镇与田野，派出随从，合力铺出各有算盘的风景。" },
] as const satisfies readonly { readonly id: GameType; readonly name: string; readonly players: string; readonly description: string }[];

export type AnyRoomView = RoomView | DrawGuessRoomView | CamelRoomView | CarcassonneRoomView;
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
