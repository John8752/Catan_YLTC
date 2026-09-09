import type { RoomSettingsInput, RoomView, TableIntentContent } from "./views.js";
import type { AnyRoomServerMessage } from "../platform/index.js";

export interface UpdateRoomSettingsRequest extends RoomSettingsInput {
  readonly seatToken: string;
  readonly expectedRevision: number;
}

export interface RerollRoomMapRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
}

export const AI_COMMENTARY_MODES = ["commentary", "summary", "prediction", "intent"] as const;
export type AiCommentaryMode = (typeof AI_COMMENTARY_MODES)[number];

export interface AiCommentaryRequest {
  readonly seatToken: string;
  readonly expectedRevision: number;
  readonly mode: AiCommentaryMode;
}

export interface AiCommentaryResponse {
  readonly mode: AiCommentaryMode;
  readonly revision: number;
  readonly content: string;
  /** Present only for "intent", whose answer is per player rather than prose. */
  readonly intent?: TableIntentContent;
}

/** Catan snapshots specialize the shared platform control messages. */
export type RoomServerMessage = Exclude<AnyRoomServerMessage, { readonly type: "room_state" }>
  | { readonly type: "room_state"; readonly room: RoomView };
