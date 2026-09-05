import { compareHistory, type GameHistoryPage } from "@catan/protocol";

/** Only contiguous history is displayed. Older cached intervals wait for missing pages after reconnect. */
export class HistoryBuffer {
  private intervals: GameHistoryPage[] = [];
  get latest(): GameHistoryPage | undefined { return this.intervals.at(-1); }
  get hasGap(): boolean { return this.intervals.length > 1; }
  clear(): void { this.intervals = []; }
  add(page: GameHistoryPage): void {
    if (this.latest?.gameId !== page.gameId) this.clear();
    const pages = [...this.intervals, page].sort((a, b) => a.range.afterRevision - b.range.afterRevision);
    const merged: GameHistoryPage[] = [];
    for (const next of pages) {
      const previous = merged.at(-1);
      if (!previous || next.range.afterRevision > previous.range.throughRevision) { merged.push(next); continue; }
      const entries = new Map([...previous.entries, ...next.entries].map((entry) => [entry.id, entry]));
      merged[merged.length - 1] = {
        gameId: page.gameId,
        range: { afterRevision: previous.range.afterRevision, throughRevision: Math.max(previous.range.throughRevision, next.range.throughRevision) },
        entries: [...entries.values()].sort(compareHistory),
      };
    }
    this.intervals = merged;
  }
}
