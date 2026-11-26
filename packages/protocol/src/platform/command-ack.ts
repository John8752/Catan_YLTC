import type { GameType } from "./index.js";
export interface RoomCommandAck {
  readonly type: "command_ack"; readonly commandId: string; readonly roomId: string;
  readonly gameId: Extract<GameType, "camel-up" | "carcassonne" | "texas-holdem">;
  readonly matchId: string; readonly roomRevision: number; readonly gameRevision: number; readonly handNumber?: number;
}
