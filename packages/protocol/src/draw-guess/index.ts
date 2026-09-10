import { taskFor, requiredGuessLength, type ReactionCounts, type AlbumPage, type Draft, type DrawGuessState, type DrawGuessPlayerCommand, type PageContent, type EditablePage } from "@catan/game-core/draw-guess";
import type { RoomBaseView } from "../platform/room-base.js";
import { narrateReveal } from "./narration.js";
import { playerPerspective } from "./reveal-story.js";
export { REVEAL_INTERVAL_MS, REVEAL_INTRO_MS } from "./narration.js";

export interface DrawGuessSettings {
  readonly textSeconds: 30 | 60 | 90;
  readonly drawingSeconds: 60 | 90 | 120;
}
export const DEFAULT_DRAW_GUESS_SETTINGS: DrawGuessSettings = { textSeconds: 60, drawingSeconds: 90 };
export interface DrawDeadline { readonly deadlineAt: number; readonly serverNow: number; readonly durationMs: number }
export interface RevealedPage extends AlbumPage { readonly reactions: ReactionCounts; readonly perspective: string; readonly narration: string }
export interface DrawGuessView {
  readonly players: readonly { readonly id: string; readonly name: string }[];
  readonly id: string;
  readonly revision: number;
  readonly you: { readonly id: string };
  readonly phase: DrawGuessState["phase"];
  readonly deadline: DrawDeadline | null;
  readonly totalSteps: number;
  readonly narration: string | null;
  readonly progress: readonly { readonly playerId: string; readonly submitted: boolean }[];
  readonly task: { readonly id: string; readonly step: number; readonly kind: EditablePage["kind"]; readonly submitted: boolean; readonly hintLength: number | null;
    readonly input: PageContent | null; readonly suggestions: readonly string[]; readonly draft: Draft | null } | null;
  readonly albums: readonly { readonly ownerId: string; readonly pages: readonly RevealedPage[] }[];
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
  const albums = cursor === 0 ? [] : state.albums.flatMap((album, i) => {
    const count = Math.max(0, Math.min(state.players.length, cursor - i * state.players.length));
    return count === 0 ? [] : [{ ownerId: album.ownerId, pages: album.pages.slice(0, count).map((page, pageIndex) => {
      const prefix = { ownerId: album.ownerId, pages: album.pages.slice(0, pageIndex + 1) };
      return { ...page, reactions: { ...(state.reactions[`${i}:${page.step}`] ?? { up: 0, down: 0 }) }, perspective: playerPerspective(prefix.pages), narration: narrateReveal([prefix], state.players, state.players.length, false) };
    }) }];
  });
  const preceding = task && task.step > 0 ? state.albums[task.albumIndex]!.pages[task.step - 1]!.content : null;
  // Opening words never accompany the drawing sent to its first guesser.
  const input: PageContent | null = preceding?.kind === "opening" ? { kind: "drawing", strokes: preceding.strokes, ...(preceding.background === undefined ? {} : { background: preceding.background }) } : preceding;
  const hintLength = task ? requiredGuessLength(state, task) : null;
  return { id: state.id, revision: state.revision, players: state.players.map(({ id, name }) => ({ id, name })), you: { id: viewerId }, phase: { ...state.phase }, deadline, totalSteps: state.players.length,
    narration: state.phase.kind === "work" ? null : narrateReveal(albums, state.players, state.players.length, state.phase.kind === "finished"),
    progress: state.players.map((p) => ({ playerId: p.id, submitted: taskFor(state, p.id)?.submitted ?? true })),
    task: task ? { id: task.id, step: task.step, kind: task.kind, submitted: task.submitted,
      input, hintLength,
      suggestions: task.step === 0 ? state.suggestions[viewerId]! : [], draft: state.drafts[viewerId] ?? null } : null,
    albums,
  };
}
