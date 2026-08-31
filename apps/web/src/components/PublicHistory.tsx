import type { GameView } from "@catan/protocol";
import { useLayoutEffect, useRef, useState } from "react";
import { Activity, ArrowDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils.js";
import { Button } from "@/components/ui/button.js";
import { ScrollArea } from "@/components/ui/scroll-area.js";

/** The server owns history and redaction. Only order, retention and scrolling live here. */
export function PublicHistory({ history }: { readonly history: GameView["history"] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [unread, setUnread] = useState(false);
  // Index within each revision/type remains stable when the rolling window drops old revisions.
  const occurrences = new Map<string, number>();
  const entries = history.map((entry) => {
    const prefix = `${entry.revision}-${entry.type}`;
    const occurrence = occurrences.get(prefix) ?? 0;
    occurrences.set(prefix, occurrence + 1);
    return { ...entry, key: `${prefix}-${occurrence}` };
  }).slice(-30);
  const signature = JSON.stringify(entries);

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
    if (viewport !== null) viewport.scrollTop = viewport.scrollHeight;
  }

  useLayoutEffect(() => {
    if (following.current) {
      scrollToLatest();
    } else {
      setUnread(true);
      // Preserve the same visible row when old entries fall out of the 30-entry window.
      const viewport = viewportRef.current;
      const saved = anchor.current;
      const row = [...(contentRef.current?.children ?? [])].find((child) => child instanceof HTMLElement && child.dataset.historyKey === saved?.key);
      if (viewport !== null && saved !== null && row !== undefined) {
        viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - saved.offset;
      }
      captureAnchor();
    }
  }, [signature]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (viewport === null || content === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (following.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="公开记录">
      <div className="mb-2 flex items-center justify-between text-sm font-bold text-[#5d665f]">
        <span className="flex items-center gap-2"><Activity className="size-4 text-[#b45c42]" />公开记录</span>
        <span className="text-xs">最新 {entries.length} 条 · 向下更新</span>
      </div>
      <ScrollArea
        className="min-h-0 flex-1 rounded-xl border border-[#6d5434]/15 bg-white/35"
        viewportRef={viewportRef}
        onViewportScroll={() => {
          const viewport = viewportRef.current;
          if (viewport === null) return;
          following.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 32;
          setPaused(!following.current);
          if (following.current) setUnread(false);
          captureAnchor();
        }}
      >
        <ol ref={contentRef} className="px-3 py-2 text-sm [overflow-anchor:none]" role="log" aria-label="操作记录，按时间从旧到新" aria-live="polite" aria-relevant="additions" aria-atomic="false">
          {entries.map((entry) => (
            <li key={entry.key} data-history-key={entry.key} data-history-type={entry.type} className={cn("border-b border-[#6d5434]/10 py-2 leading-relaxed break-words text-[#47534e] last:border-0", entry.type === "victory-warning" && "font-bold text-[#805418]")}>
              {entry.type === "victory-warning" ? <Trophy className="mr-1 inline size-3.5 align-text-bottom" aria-hidden="true" /> : null}
              {entry.message}
              {entry.privateDetail === null ? null : <span className="mt-1 block text-sm font-bold text-[#a34e39]">{entry.privateDetail}</span>}
            </li>
          ))}
          {entries.length === 0 ? <li className="py-8 text-center text-[#7c817a]">对局记录会显示在这里</li> : null}
        </ol>
      </ScrollArea>
      {paused ? <Button size="sm" className="mt-2 shrink-0" onClick={scrollToLatest}><ArrowDown className="size-4" />{unread ? "有新记录 · 回到最新" : "回到最新"}</Button> : null}
    </section>
  );
}
