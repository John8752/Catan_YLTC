import type { CamelRoomView } from "./index.js";
import { changedFields, sameValue } from "../platform/delta.js";

export interface CamelDelta {
  readonly type: "camel_delta"; readonly roomId: string; readonly matchId: string; readonly viewerId: string; readonly baseRevision: number; readonly revision: number;
  readonly room: Partial<Pick<CamelRoomView, "members" | "hostPlayerId">>;
  readonly game: Partial<Omit<NonNullable<CamelRoomView["game"]>, "log" | "id" | "you">>;
  /** Revision-bound splice of the bounded log. No string-based deduplication. */
  readonly log?: { readonly drop: number; readonly append: readonly string[] };
}
export function camelDelta(before: CamelRoomView, after: CamelRoomView): CamelDelta {
  const { log: oldLog, id: _oldId, you: _oldYou, ...oldGame } = before.game!;
  const { log, id: _id, you: _you, ...game } = after.game!;
  let overlap = Math.min(oldLog.length, log.length);
  while (overlap > 0 && !sameValue(oldLog.slice(oldLog.length - overlap), log.slice(0, overlap))) overlap--;
  return { type: "camel_delta", roomId: after.id, matchId: after.matchId!, viewerId: after.game!.you.id, baseRevision: before.revision, revision: after.revision,
    room: changedFields({ members: before.members, hostPlayerId: before.hostPlayerId }, { members: after.members, hostPlayerId: after.hostPlayerId }),
    game: changedFields(oldGame, game), ...(!sameValue(oldLog, log) ? { log: { drop: oldLog.length - overlap, append: log.slice(overlap) } } : {}) };
}
export function applyCamelDelta(before: CamelRoomView, delta: CamelDelta): CamelRoomView {
  const game = before.game!;
  if (delta.log && (delta.log.drop < 0 || delta.log.drop > game.log.length || !Number.isInteger(delta.log.drop))) throw new Error("Invalid log interval");
  return { ...before, ...delta.room, revision: delta.revision, game: { ...game, ...delta.game,
    log: delta.log ? [...game.log.slice(delta.log.drop), ...delta.log.append] : game.log } };
}
