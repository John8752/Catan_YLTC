export const DRAW_COLORS = ["#222222", "#ffffff", "#e34b4b", "#ef9135", "#f5d54a", "#42a66a", "#438dcc", "#9864bf"] as const;
export const DRAW_WIDTHS = [3, 8, 16] as const;
export const DRAW_LIMITS = { width: 800, height: 600, strokes: 100, points: 1500, text: 80 } as const;
export interface Stroke { readonly color: string; readonly width: number; readonly points: readonly (readonly [number, number])[] }
export type EditablePage = { readonly kind: "text"; readonly text: string } | { readonly kind: "drawing"; readonly strokes: readonly Stroke[] };
export type PageContent = EditablePage | { readonly kind: "missing"; readonly expected: "text" | "drawing" };
export interface AlbumPage { readonly authorId: string; readonly step: number; readonly timedOut: boolean; readonly content: PageContent }
export interface Album { readonly ownerId: string; readonly pages: readonly AlbumPage[] }
export interface Draft { readonly sequence: number; readonly page: EditablePage }
export interface DrawPlayer { readonly id: string; readonly name: string }
export interface DrawGuessState {
  readonly id: string;
  readonly revision: number;
  readonly players: readonly DrawPlayer[];
  readonly suggestions: Readonly<Record<string, readonly string[]>>;
  readonly phase: { readonly kind: "work"; readonly step: number } | { readonly kind: "reveal"; readonly cursor: number } | { readonly kind: "finished" };
  readonly albums: readonly Album[];
  readonly drafts: Readonly<Record<string, Draft>>;
}
export type DrawGuessCommand =
  | { readonly type: "draft"; readonly matchId: string; readonly taskId: string; readonly sequence: number; readonly page: EditablePage }
  | { readonly type: "submit"; readonly matchId: string; readonly taskId: string; readonly page: EditablePage }
  | { readonly type: "expire"; readonly matchId: string; readonly step: number }
  | { readonly type: "reveal"; readonly matchId: string; readonly expectedCursor: number };
export type DrawGuessPlayerCommand = Exclude<DrawGuessCommand, { type: "expire" }>;
export interface DrawTask { readonly id: string; readonly step: number; readonly albumIndex: number; readonly kind: "text" | "drawing"; readonly submitted: boolean }
export class DrawGuessError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
