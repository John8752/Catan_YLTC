import { taskFor, type AlbumPage, type Draft, type DrawGuessState, type DrawGuessPlayerCommand, type PageContent } from "@catan/game-core/draw-guess";
import type { RoomBaseView } from "../platform/room-base.js";

export interface DrawGuessSettings {
  readonly textSeconds: 30 | 60 | 90;
  readonly drawingSeconds: 60 | 90 | 120;
}
export const DEFAULT_DRAW_GUESS_SETTINGS: DrawGuessSettings = { textSeconds: 60, drawingSeconds: 90 };
export interface DrawDeadline { readonly deadlineAt: number; readonly serverNow: number; readonly durationMs: number }
export interface DrawGuessView {
  readonly players: readonly { readonly id: string; readonly name: string }[];
  readonly id: string;
  readonly revision: number;
  readonly you: { readonly id: string };
  readonly phase: DrawGuessState["phase"];
  readonly deadline: DrawDeadline | null;
  readonly totalSteps: number;
  readonly progress: readonly { readonly playerId: string; readonly submitted: boolean }[];
  readonly task: { readonly id: string; readonly step: number; readonly kind: "text" | "drawing"; readonly submitted: boolean;
    readonly input: PageContent | null; readonly suggestions: readonly string[]; readonly draft: Draft | null } | null;
  readonly albums: readonly { readonly ownerId: string; readonly pages: readonly AlbumPage[] }[];
}
export interface DrawGuessRoomView extends RoomBaseView {
  readonly gameId: "draw-guess";
  readonly settings: DrawGuessSettings;
  readonly game: DrawGuessView | null;
}
export interface DrawGuessCommandRequest {
  readonly seatToken: string;
  readonly commandId: string;
  readonly command: DrawGuessPlayerCommand;
}
export interface DrawGuessSettlementV1 {
  readonly playerCount: number;
  readonly albumCount: number;
  readonly players: readonly { readonly id: string; readonly name: string; readonly submittedPages: number; readonly timedOutPages: number }[];
}
/** Every field is constructed explicitly. Never spread authoritative state into a view. */
export function projectDrawGuess(state: DrawGuessState, viewerId: string, deadline: DrawDeadline | null): DrawGuessView {
  if (!state.players.some((p) => p.id === viewerId)) throw new Error("Unknown drawing-telephone viewer");
  const task = taskFor(state, viewerId);
  const cursor = state.phase.kind === "finished" ? state.players.length ** 2 : state.phase.kind === "reveal" ? state.phase.cursor : 0;
  return { id: state.id, revision: state.revision, players: state.players.map(({ id, name }) => ({ id, name })), you: { id: viewerId }, phase: { ...state.phase }, deadline, totalSteps: state.players.length,
    progress: state.players.map((p) => ({ playerId: p.id, submitted: taskFor(state, p.id)?.submitted ?? true })),
    task: task ? { id: task.id, step: task.step, kind: task.kind, submitted: task.submitted,
      input: task.step === 0 ? null : state.albums[task.albumIndex]!.pages[task.step - 1]!.content,
      suggestions: task.step === 0 ? state.suggestions[viewerId]! : [], draft: state.drafts[viewerId] ?? null } : null,
    albums: cursor === 0 ? [] : state.albums.flatMap((album, i) => {
      const count = Math.max(0, Math.min(state.players.length, cursor - i * state.players.length));
      return count === 0 ? [] : [{ ownerId: album.ownerId, pages: album.pages.slice(0, count) }];
    }),
  };
}
