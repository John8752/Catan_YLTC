import type { GameView, HistoryRange } from "@catan/protocol";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { Button } from "@/components/ui/button.js";
import { ScrollArea } from "@/components/ui/scroll-area.js";

export interface HistoryControls {
  readonly historyHasGap?: boolean;
  readonly historyLoading?: boolean;
  readonly historyError?: string | null;
  readonly onLoadEarlierHistory?: () => void | Promise<void>;
}
/** The server owns history and redaction. This component owns reading/scrolling only. */
export function PublicHistory({ history, historyRange, historyHasGap = false, historyLoading = false, historyError, onLoadEarlierHistory }: HistoryControls & {
  readonly history: GameView["history"]; readonly historyRange?: HistoryRange | undefined;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const scrollSize = useRef({ height: 0, content: 0 });
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(false);
  const entries = useMemo(() => {
    const occurrences = new Map<string, number>();
    return history.map((entry) => {
      const prefix = `${entry.revision}-${entry.type}`;
      const occurrence = occurrences.get(prefix) ?? 0;
      occurrences.set(prefix, occurrence + 1);
      return { ...entry, key: entry.id ?? `${prefix}-${occurrence}` };
    });
  }, [history]);
  const lastKey = entries.at(-1)?.key;
  const previousLast = useRef(lastKey);
  const signature = `${entries[0]?.key}:${lastKey}:${entries.length}`;
  const hasEarlier = ((historyRange?.afterRevision ?? 0) > 0 || historyHasGap) && onLoadEarlierHistory !== undefined;
  function loadEarlier() {
    if (!hasEarlier || historyLoading) return;
    following.current = false; setPaused(true); captureAnchor();
    void onLoadEarlierHistory?.();
  }

  function captureAnchor() {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const top = viewport.getBoundingClientRect().top;
    const row = [...(contentRef.current?.children ?? [])].find((child) => child.getBoundingClientRect().bottom > top);
    anchor.current = row instanceof HTMLElement && row.dataset.historyKey !== undefined
      ? { key: row.dataset.historyKey, offset: row.getBoundingClientRect().top - top }
      : null;
  }

  function scrollToLatest() {
    following.current = true;
    setPaused(false);
    setUnread(false);
    const viewport = viewportRef.current;
    if (viewport !== null) {
      viewport.scrollTop = viewport.scrollHeight;
      scrollSize.current = { height: viewport.clientHeight, content: viewport.scrollHeight };
    }
  }

  useLayoutEffect(() => {
    if (following.current) {
      scrollToLatest();
    } else {
      if (previousLast.current !== lastKey) setUnread(true);
      // Prepending older pages must preserve the same visible row and its offset.
      const viewport = viewportRef.current;
      const saved = anchor.current;
      const row = [...(contentRef.current?.children ?? [])].find((child) => child instanceof HTMLElement && child.dataset.historyKey === saved?.key);
      if (viewport !== null && saved !== null && row !== undefined) {
        viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.offset;
      }
      captureAnchor();
    }
    previousLast.current = lastKey;
  }, [signature]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (viewport === null || content === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (following.current) viewport.scrollTop = viewport.scrollHeight;
      scrollSize.current = { height: viewport.clientHeight, content: viewport.scrollHeight };
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="公开记录">
      <div className="mb-2 flex items-center justify-between text-sm font-bold text-[var(--sidebar-muted,#5d665f)]">
        <span className="flex items-center gap-2"><Activity className="size-4 text-[var(--sidebar-accent,#b45c42)]" />公开记录</span>
        <span className="text-xs">{historyRange && (historyRange.afterRevision > 0 || historyHasGap) ? "已加载 " : ""}{entries.length} 条</span>
      </div>
      <ScrollArea
        className="min-h-0 flex-1 rounded-xl border border-[var(--sidebar-line,#6d543426)] bg-[var(--sidebar-soft,#ffffff59)]"
        viewportRef={viewportRef}
        onViewportScroll={() => {
          const viewport = viewportRef.current;
          if (viewport === null) return;
          // Layout can shrink the remaining history area before ResizeObserver runs.
          // That scroll event is not a player choosing to read older entries.
          const resized = scrollSize.current.height !== viewport.clientHeight || scrollSize.current.content !== viewport.scrollHeight;
          scrollSize.current = { height: viewport.clientHeight, content: viewport.scrollHeight };
          if (resized) {
            if (following.current) viewport.scrollTop = viewport.scrollHeight;
            return;
          }
          following.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 32;
          setPaused(!following.current);
          if (following.current) setUnread(false);
          captureAnchor();
          if (viewport.scrollTop <= 48 && !following.current && !historyError) loadEarlier();
        }}
      >
        {hasEarlier && <div className="grid gap-1 px-3 pt-2">
          <Button variant="ghost" size="sm" disabled={historyLoading} onClick={loadEarlier}>
            {historyLoading ? "正在加载较早记录…" : historyError ? "重试加载较早记录" : "加载较早记录"}
          </Button>
          {historyError && <p role="alert" className="text-xs text-[#a34e39]">{historyError}</p>}
        </div>}
        <ol ref={contentRef} className="px-3 py-2 text-sm [overflow-anchor:none]" role="log" aria-label="操作记录，按时间从旧到新" aria-live="polite" aria-relevant="additions" aria-atomic="false">
          {entries.map((entry) => (
            <li key={entry.key} data-history-key={entry.key} data-history-type={entry.type} className={cn("border-b border-[var(--sidebar-line,#6d54341a)] py-2 leading-relaxed break-words text-[var(--sidebar-ink,#47534e)] last:border-0", entry.type === "victory-warning" && "font-bold text-[var(--sidebar-accent,#805418)]")}>
              {entry.type === "victory-warning" ? <Trophy className="mr-1 inline size-3.5 align-text-bottom" aria-hidden="true" /> : null}
              {entry.message}
              {entry.privateDetail === null ? null : <span className="mt-1 block text-sm font-bold text-[var(--sidebar-accent,#a34e39)]">{entry.privateDetail}</span>}
            </li>
          ))}
          {entries.length === 0 ? <li className="py-8 text-center text-[var(--sidebar-muted,#7c817a)]">暂无记录</li> : null}
        </ol>
      </ScrollArea>
      {paused ? <Button size="sm" className="mt-2 shrink-0" onClick={scrollToLatest}><ArrowDown className="size-4" />{unread ? "有新记录 · 回到最新" : "回到最新"}</Button> : null}
    </section>
  );
}
