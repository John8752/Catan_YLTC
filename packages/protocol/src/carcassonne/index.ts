import { legalPlacements, previewPlacement, regions, type CarcassonneState, type CarcassonnePlayer, type CarcassonnePhase, type PlacedTile, type Meeple, type ScoreEntry, type Region, type Placement, type PlaceCommand } from "@catan/game-core/carcassonne";
import type { RoomBaseView } from "../platform/room-base.js";

export type { PlaceCommand } from "@catan/game-core/carcassonne";
export interface LegalPlacement extends Placement { readonly meepleOptions: readonly string[] }
export interface CarcassonneView {
  readonly id: string; readonly revision: number; readonly you: { readonly id: string };
  readonly phase: CarcassonnePhase;
  readonly players: readonly (CarcassonnePlayer & { readonly availableMeeples: number })[];
  readonly board: readonly PlacedTile[]; readonly meeples: readonly Meeple[];
  readonly currentTile: string | null; readonly remainingTiles: number; readonly discardedCount: number;
  readonly placements: readonly LegalPlacement[]; readonly regions: readonly Region[]; readonly scores: readonly ScoreEntry[];
}
export interface CarcassonneRoomView extends RoomBaseView {
  readonly gameId: "carcassonne";
  readonly game: CarcassonneView | null;
}
export interface CarcassonneCommandRequest { readonly seatToken: string; readonly commandId: string; readonly command: PlaceCommand }
export interface CarcassonneSettlementV1 {
  readonly playerCount: number; readonly tilesPlaced: number; readonly winnerIds: readonly string[];
  readonly players: readonly { readonly id: string; readonly name: string; readonly score: number; readonly rank: number }[];
}
/** Never include seed, deck order, room credentials or unpublished client previews. */
const derived = new WeakMap<CarcassonneState, { regions: readonly Region[]; placements?: readonly LegalPlacement[] }>();
export function projectCarcassonne(state: CarcassonneState, viewerId: string): CarcassonneView {
  if (!state.players.some((p) => p.id === viewerId)) throw new Error("Unknown Carcassonne viewer");
  // Core states are immutable. Public topology and the actor's choices are computed
  // once per state, while every caller still receives independent transport values.
  let cached = derived.get(state);
  if (!cached) { cached = { regions: regions(state.board, state.meeples) }; derived.set(state, cached); }
  const active = state.phase.kind === "turn" && state.phase.playerId === viewerId && state.currentTile;
  if (active && !cached.placements) cached.placements = legalPlacements(state.board, state.currentTile!).map(p => ({ ...p, meepleOptions: [...previewPlacement(state, viewerId, p).meepleOptions] }));
  const placements = active ? cached.placements!.map(p => ({ ...p, meepleOptions: [...p.meepleOptions] })) : [];
  return { id: state.id, revision: state.revision, you: { id: viewerId }, phase: { ...state.phase },
    players: state.players.map((p) => ({ ...p, availableMeeples: 7 - state.meeples.filter((m) => m.playerId === p.id).length })),
    board: state.board.map(({ id, type, x, y, rotation }) => ({ id, type, x, y, rotation })), meeples: state.meeples.map((m) => ({ ...m })), currentTile: state.currentTile,
    remainingTiles: state.deck.length + Number(state.currentTile !== null), discardedCount: state.discarded.length,
    placements, regions: cached.regions.map(r => ({ ...r, refs: [...r.refs], tileIds: [...r.tileIds], followers: { ...r.followers }, winnerIds: [...r.winnerIds], completedCityIds: [...r.completedCityIds] })), scores: state.scores.map((s) => ({ ...s, playerIds: [...s.playerIds], tileIds: [...s.tileIds] })) };
}
