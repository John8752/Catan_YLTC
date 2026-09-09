import { validatePage, type EditablePage } from "@catan/game-core/draw-guess";
import type { Draft } from "@catan/game-core/draw-guess";
import type { PlayerSession } from "../../room-session.js";
const PREFIX = "yltc:draw-draft:";
interface StoredDraft extends Draft { readonly savedAt: number }
export function draftKey(session: PlayerSession, matchId: string, taskId: string): string {
  return PREFIX + JSON.stringify([session.roomId, matchId, session.playerId, taskId]);
}
export function readDraft(storage: Storage, key: string, kind: EditablePage["kind"]): Draft | null {
  try {
    const raw = storage.getItem(key); if (!raw || raw.length > 100_000) return null;
    const value = JSON.parse(raw) as StoredDraft;
    if (!Number.isSafeInteger(value.sequence) || value.sequence < 1 || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 24 * 60 * 60_000) return null;
    return { sequence: value.sequence, page: validatePage(value.page, kind, true) };
  } catch { return null; }
}
export function writeDraft(storage: Storage, key: string, draft: Draft): boolean {
  try { storage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() })); return true; } catch { return false; }
}
export function removeDraft(storage: Storage, key: string): void { try { storage.removeItem(key); } catch { /* Storage can be disabled. */ } }
export function pruneDrafts(storage: Storage): void {
  try {
    const entries = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => key?.startsWith(PREFIX) ?? false);
    for (const key of entries) {
      try { const value = JSON.parse(storage.getItem(key) ?? "{}") as StoredDraft; if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 86400_000) storage.removeItem(key); }
      catch { storage.removeItem(key); }
    }
  } catch { /* Drawing still works with in-memory/server drafts. */ }
}
