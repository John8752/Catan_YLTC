import type { CarcassonneRoomView, CarcassonneView } from "./index.js";
import { applyEntities, changedFields, entityDelta, type EntityDelta } from "../platform/delta.js";

type Collections = Pick<CarcassonneView, "board" | "meeples" | "regions" | "scores">;
export interface CarcassonneDelta {
  readonly type: "carcassonne_delta"; readonly roomId: string; readonly matchId: string; readonly viewerId: string; readonly baseRevision: number; readonly revision: number;
  readonly room: Partial<Pick<CarcassonneRoomView, "members" | "hostPlayerId">>;
  readonly game: Partial<Omit<CarcassonneView, keyof Collections | "id" | "you">>;
  readonly board?: EntityDelta<Collections["board"][number]>; readonly meeples?: EntityDelta<Collections["meeples"][number]>;
  readonly regions?: EntityDelta<Collections["regions"][number]>; readonly scores?: EntityDelta<Collections["scores"][number]>;
}
const id = (item: { readonly id: string | number }) => String(item.id);
const pawnKey = (item: Collections["meeples"][number]) => `${item.tileId}/${item.featureId}/${item.playerId}`;
export function carcassonneDelta(before: CarcassonneRoomView, after: CarcassonneRoomView): CarcassonneDelta {
  const { board: oldBoard, meeples: oldPawns, regions: oldRegions, scores: oldScores, id: _oldId, you: _oldYou, ...oldGame } = before.game!;
  const { board, meeples, regions, scores, id: _id, you: _you, ...game } = after.game!;
  return { type: "carcassonne_delta", roomId: after.id, matchId: after.matchId!, viewerId: after.game!.you.id, baseRevision: before.revision, revision: after.revision,
    room: changedFields({ members: before.members, hostPlayerId: before.hostPlayerId }, { members: after.members, hostPlayerId: after.hostPlayerId }), game: changedFields(oldGame, game),
    ...optional("board", entityDelta(oldBoard, board, id)), ...optional("meeples", entityDelta(oldPawns, meeples, pawnKey)),
    ...optional("regions", entityDelta(oldRegions, regions, id)), ...optional("scores", entityDelta(oldScores, scores, id)) };
}
function optional<K extends string, T>(key: K, value: T | undefined): Partial<Record<K, T>> { return value === undefined ? {} : { [key]: value } as Record<K, T>; }
export function applyCarcassonneDelta(before: CarcassonneRoomView, delta: CarcassonneDelta): CarcassonneRoomView {
  const game = before.game!;
  return { ...before, ...delta.room, revision: delta.revision, game: { ...game, ...delta.game,
    board: applyEntities(game.board, delta.board, id), meeples: applyEntities(game.meeples, delta.meeples, pawnKey),
    regions: applyEntities(game.regions, delta.regions, id), scores: applyEntities(game.scores, delta.scores, id) } };
}
