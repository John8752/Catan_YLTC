import { Sparkles } from "lucide-react";
import type { PageReaction } from "@catan/game-core/draw-guess";
import type { RevealedPage } from "@catan/protocol/draw-guess";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { DrawingPreview } from "./DrawingCanvas.js";

export function HostBubble({ children, label, live = false }: { readonly children: string; readonly label?: string; readonly live?: boolean }) {
  return <div className="flex min-w-0 items-start gap-2 sm:gap-3" aria-label={label}>
    <span className="grid size-9 shrink-0 place-content-center rounded-full border border-amber-300 bg-amber-100 text-amber-800" aria-hidden="true"><Sparkles className="size-4" /></span>
    <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-semibold text-amber-900">主持人</p><p role={live ? "status" : undefined} className="break-words rounded-2xl rounded-tl-sm border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">{children}</p></div>
  </div>;
}
const avatarColors = ["bg-rose-100 text-rose-800", "bg-sky-100 text-sky-800", "bg-emerald-100 text-emerald-800", "bg-violet-100 text-violet-800", "bg-orange-100 text-orange-800", "bg-cyan-100 text-cyan-800"];
export function RevealEntry({ page, name, own, playerIndex, live, onReact }: { readonly page: RevealedPage; readonly name: string; readonly own: boolean; readonly playerIndex: number; readonly live: boolean; readonly onReact: (reaction: PageReaction) => void }) {
  const content = page.content;
  return <>
    <div className={cn("flex min-w-0 items-start gap-2 sm:gap-3", own && "flex-row-reverse")} data-speaker={page.authorId} data-own={own}>
      <span className={cn("grid size-9 shrink-0 place-content-center rounded-full text-sm font-bold", avatarColors[playerIndex % avatarColors.length])} aria-hidden="true">{[...name][0]}</span>
      <div className="grid min-w-0 flex-1 gap-2">
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", own && "justify-end")}><strong className="break-all text-sm text-slate-800">{name}{own ? "（我）" : ""}</strong><span className="text-xs text-slate-500">第 {page.step + 1} 棒{page.timedOut ? " · 超时收稿" : ""}</span></div>
        <div className={cn("grid gap-3 rounded-2xl border p-3 sm:p-4", own ? "rounded-tr-sm border-teal-200 bg-teal-50/80" : "rounded-tl-sm border-stone-200 bg-white")} aria-label={`第 ${page.step + 1} 棒发言`}>
          <p className="break-words text-base font-medium leading-relaxed text-slate-900">{page.perspective}</p>
          {(content.kind === "opening" || content.kind === "drawing") && <DrawingPreview strokes={content.strokes} background={content.background} label={`${name}的画作`} />}
        </div>
        {content.kind !== "missing" && <div className={cn("flex flex-wrap gap-2", own && "justify-end")} role="group" aria-label={`第 ${page.step + 1} 页表态`}>
          <Button variant="outline" className="min-h-11 gap-1.5 rounded-full px-3 tabular-nums" aria-label={`点赞，${page.reactions.up} 次`} onClick={() => onReact("up")}><span aria-hidden="true">👍</span><span>点赞 {page.reactions.up}</span></Button>
          <Button variant="outline" className="min-h-11 gap-1.5 rounded-full px-3 tabular-nums" aria-label={`喝倒彩，${page.reactions.down} 次`} onClick={() => onReact("down")}><span aria-hidden="true">👎</span><span>喝倒彩 {page.reactions.down}</span></Button>
        </div>}
      </div>
    </div>
    <HostBubble label={`第 ${page.step + 1} 页主持人串词`} live={live}>{page.narration}</HostBubble>
  </>;
}
