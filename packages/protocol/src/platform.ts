import type { RoomView } from "./views.js";
import type { PlayerColor } from "@catan/game-core/primitives";
import type { DrawGuessRoomView } from "./draw-guess/index.js";

export const GAME_IDS = ["catan", "draw-guess"] as const;
export type GameType = (typeof GAME_IDS)[number];
export interface LobbyMemberView {
  readonly id: string;
  readonly name: string;
  readonly color: PlayerColor;
  readonly isHost: boolean;
}
export const GAME_CATALOG = [
  { id: "catan", name: "卡坦", players: "2–6 人", description: "造路建城、交换资源，一起经营海岛。" },
  { id: "draw-guess", name: "传画猜词", players: "3–6 人", description: "你画我猜接力，最后一起看词语怎么越传越离谱。" },
] as const satisfies readonly { readonly id: GameType; readonly name: string; readonly players: string; readonly description: string }[];

export interface RoomBaseView {
  readonly id: string;
  readonly gameId: GameType;
  /** Null in a fresh lobby; a new value is allocated on every start. */
  readonly matchId: string | null;
  readonly revision: number;
  readonly hostPlayerId: string;
  readonly members: readonly LobbyMemberView[];
}
export type AnyRoomView = RoomView | DrawGuessRoomView;
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
