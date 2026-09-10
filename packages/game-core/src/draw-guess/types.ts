export const DRAW_COLORS = ["#222222", "#ffffff", "#e34b4b", "#ef9135", "#f5d54a", "#42a66a", "#438dcc", "#9864bf"] as const;
export const DRAW_WIDTHS = [3, 8, 16, 32] as const;
export const DRAW_BACKGROUNDS = ["#ffffff", "#fff3bf", "#dbeafe", "#dcfce7", "#fce7f3", "#222222"] as const;
export const DRAW_TOOLS = ["pen", "eraser"] as const;
export type DrawingTool = typeof DRAW_TOOLS[number];
export const DRAW_LIMITS = { width: 800, height: 600, strokes: 100, points: 1500, text: 80 } as const;
export interface Stroke { readonly color: string; readonly width: number; readonly tool?: DrawingTool | undefined; readonly points: readonly (readonly [number, number])[] }
export interface DrawingData { readonly strokes: readonly Stroke[]; readonly background?: string | undefined }
export type EditablePage = { readonly kind: "text"; readonly text: string } | ({ readonly kind: "drawing" } & DrawingData)
  | ({ readonly kind: "opening"; readonly word: string } & DrawingData);
export type PageContent = EditablePage | { readonly kind: "missing"; readonly expected: EditablePage["kind"] };
export interface AlbumPage { readonly authorId: string; readonly step: number; readonly timedOut: boolean; readonly content: PageContent }
export interface Album { readonly ownerId: string; readonly pages: readonly AlbumPage[] }
export interface Draft { readonly sequence: number; readonly page: EditablePage }
export interface DrawPlayer { readonly id: string; readonly name: string }
export type PageReaction = "up" | "down";
export interface ReactionCounts { readonly up: number; readonly down: number }
export interface DrawGuessState {
  readonly id: string;
  readonly revision: number;
  readonly players: readonly DrawPlayer[];
  readonly suggestions: Readonly<Record<string, readonly string[]>>;
  readonly wordSeed: number;
  readonly suggestionRounds: Readonly<Record<string, number>>;
  readonly phase: { readonly kind: "work"; readonly step: number } | { readonly kind: "reveal"; readonly cursor: number } | { readonly kind: "finished" };
  readonly albums: readonly Album[];
  readonly drafts: Readonly<Record<string, Draft>>;
  readonly reactions: Readonly<Record<string, ReactionCounts>>;
}
export type DrawGuessCommand =
  | { readonly type: "reroll"; readonly matchId: string; readonly taskId: string; readonly sequence: number; readonly page: Extract<EditablePage, { kind: "opening" }> }
  | { readonly type: "draft"; readonly matchId: string; readonly taskId: string; readonly sequence: number; readonly page: EditablePage }
  | { readonly type: "submit"; readonly matchId: string; readonly taskId: string; readonly page: EditablePage }
  | { readonly type: "expire"; readonly matchId: string; readonly step: number }
  | { readonly type: "react"; readonly matchId: string; readonly albumOwnerId: string; readonly step: number; readonly reaction: PageReaction }
  | { readonly type: "reveal"; readonly matchId: string; readonly expectedCursor: number };
export type DrawGuessPlayerCommand = Extract<DrawGuessCommand, { type: "draft" | "submit" | "react" | "reroll" }>;
export interface DrawTask { readonly id: string; readonly step: number; readonly albumIndex: number; readonly kind: EditablePage["kind"]; readonly submitted: boolean }
export class DrawGuessError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
