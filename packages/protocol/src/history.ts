import type { GameEventRecord, GameState } from "@catan/game-core";
import type { GameHistoryEntryView } from "./views.js";
import { projectHistoryRecord } from "./history-record.js";
import { victoryWarningHistory, type VictoryWarningEffectView } from "./victory-warning.js";

export const HISTORY_PAGE_SIZE = 50;
/** Every readable entry in (afterRevision, throughRevision] is included, even for empty intervals. */
export interface HistoryRange { readonly afterRevision: number; readonly throughRevision: number }
export interface IndexedHistoryEntry extends GameHistoryEntryView { readonly id: string }
export interface GameHistoryPage {
  /** The room's game instance (GameView.id), distinct from account settlement gameId/type. */
  readonly gameId: string;
  readonly range: HistoryRange;
  readonly entries: readonly IndexedHistoryEntry[];
}

/** Upper bound without scanning the whole match on every push/page. */
export function eventIndexAfter(records: readonly GameEventRecord[], revision: number): number {
  let lo = 0; let hi = records.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (records[mid]!.revision <= revision) lo = mid + 1; else hi = mid; }
  return lo;
}
export function compareHistory(a: IndexedHistoryEntry, b: IndexedHistoryEntry): number {
  return a.revision - b.revision || (a.id < b.id ? -1 : a.id === b.id ? 0 : 1);
}
function indexedRecord(state: GameState, viewerId: string, record: GameEventRecord, index: number): IndexedHistoryEntry[] {
  return projectHistoryRecord(state, viewerId, record).map((entry, part) => ({
    ...entry, id: `e:${String(index).padStart(16, "0")}:${part}`,
  }));
}
function indexedWarning(warning: VictoryWarningEffectView, index: number): IndexedHistoryEntry {
  return { ...victoryWarningHistory(warning), id: `w:${String(index).padStart(16, "0")}` };
}

export function projectHistorySince(state: GameState, viewerId: string, records: readonly GameEventRecord[],
  warnings: readonly VictoryWarningEffectView[], afterRevision: number): GameHistoryPage {
  const start = eventIndexAfter(records, afterRevision);
  const entries = records.slice(start).flatMap((record, index) => indexedRecord(state, viewerId, record, start + index));
  entries.push(...warnings.flatMap((warning, index) => warning.revision > afterRevision ? [indexedWarning(warning, index)] : []));
  return { gameId: state.id, range: { afterRevision, throughRevision: state.revision }, entries: entries.sort(compareHistory) };
}

/** Page backward by readable entries, keeping an entire command revision together. */
export function projectHistoryPage(state: GameState, viewerId: string, records: readonly GameEventRecord[],
  warnings: readonly VictoryWarningEffectView[], beforeRevision = state.revision + 1): GameHistoryPage {
  const throughRevision = Math.min(beforeRevision - 1, state.revision);
  let index = eventIndexAfter(records, throughRevision) - 1;
  const remainingWarnings = warnings.filter((warning) => warning.revision <= throughRevision).sort((a, b) => a.revision - b.revision);
  const entries: IndexedHistoryEntry[] = [];
  let afterRevision = 0;
  while (index >= 0 || remainingWarnings.length > 0) {
    const revision = Math.max(records[index]?.revision ?? 0, remainingWarnings.at(-1)?.revision ?? 0);
    while (index >= 0 && records[index]!.revision === revision) {
      entries.push(...indexedRecord(state, viewerId, records[index]!, index)); index--;
    }
    while (remainingWarnings.at(-1)?.revision === revision) {
      const warning = remainingWarnings.pop()!; entries.push(indexedWarning(warning, warnings.indexOf(warning)));
    }
    if (entries.length >= HISTORY_PAGE_SIZE && (index >= 0 || remainingWarnings.length > 0)) {
      afterRevision = revision - 1; break;
    }
  }
  return { gameId: state.id, range: { afterRevision, throughRevision }, entries: entries.sort(compareHistory) };
}
