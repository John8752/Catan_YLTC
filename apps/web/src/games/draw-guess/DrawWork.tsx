import { useEffect, useState } from "react";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { DrawGuessView } from "@catan/protocol/draw-guess";
import { guessCharacterCount, pageIsEmpty, type PageContent } from "@catan/game-core/draw-guess";
import type { PlayerSession } from "../../room-session.js";
import { Button } from "../../components/ui/button.js";
import { DrawingCanvas, DrawingPreview } from "./DrawingCanvas.js";
import { useDraft } from "./use-draft.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
import { cn } from "../../lib/utils.js";

export function Deadline({ game }: { readonly game: DrawGuessView }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const deadline = game.deadline; if (!deadline) return;
    const end = Date.now() + deadline.deadlineAt - deadline.serverNow;
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [game.deadline]);
  if (!game.deadline) return null;
  return <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-sm font-bold text-amber-900" role="timer" aria-label={game.phase.kind === "reveal" ? "下次自动揭晓" : "本轮剩余时间"}>{remaining > 0 ? `${remaining} 秒` : game.phase.kind === "reveal" ? "正在翻页…" : "正在收稿…"}</span>;
}
export function PageDisplay({ content }: { readonly content: PageContent }) {
  return content.kind === "opening" ? <><p className="break-words rounded-xl bg-amber-50 p-4 text-center text-xl font-bold text-slate-900">原词：{content.word}</p><DrawingPreview strokes={content.strokes} background={content.background} /></> : content.kind === "drawing" ? <DrawingPreview strokes={content.strokes} background={content.background} />
    : content.kind === "text" ? <p className="break-words rounded-xl bg-amber-50 p-4 text-center text-xl font-bold text-slate-900">{content.text}</p>
      : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-600">这一页没赶上交稿，凭想象继续吧。</div>;
}
export function DrawWork({ game, session, onRoom }: { readonly game: DrawGuessView; readonly session: PlayerSession; readonly onRoom: (room: AnyRoomView) => void }) {
  const task = game.task!;
  const draft = useDraft(session, game, task, onRoom);
  const page = draft.page;
  const [choosing, setChoosing] = useState(false);
  const choices = page.kind === "opening" && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="六个候选词">{task.suggestions.map((word) => <Button key={word} disabled={draft.locked} variant={page.word === word ? "default" : "outline"} aria-pressed={page.word === word} className="h-auto min-h-11 whitespace-normal break-words px-2" onClick={() => { draft.change({ ...page, word }); setChoosing(false); }}>{word}</Button>)}</div>;
  const length = page.kind === "text" ? guessCharacterCount(page.text) : 0;
  const wrongLength = page.kind === "text" && task.hintLength !== null && length !== task.hintLength;
  const empty = pageIsEmpty(page);
  if (task.submitted) return <section className="grid min-h-64 place-content-center gap-3 rounded-2xl border bg-white p-6 text-center" aria-label="等待其他玩家">
    <span className="text-4xl" aria-hidden="true">✓</span><h2 className="text-2xl font-bold">交稿成功！</h2>
    <p>还有 {game.progress.filter((p) => !p.submitted).length} 位朋友正在创作。</p><p className="text-sm text-slate-500">先别剧透，等会儿一起揭晓。</p>
  </section>;
  return <section className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:p-3", page.kind !== "text" && "min-h-0 flex-1")} aria-label="本轮任务">
    <div className="flex shrink-0 items-center justify-between gap-2"><h2 className="text-base font-bold">{task.kind === "opening" ? page.kind === "opening" && page.word ? "画出这个词" : "先选一个词，再开始画" : task.kind === "drawing" ? "把这句话画出来" : "这幅画在说什么？"}</h2><Deadline game={game} /></div>
    {task.input && <div className="shrink-0"><PageDisplay content={task.input} /></div>}
    {page.kind === "opening" && page.word && <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl bg-amber-50 px-3"><p aria-label="本轮题目" className="min-w-0 break-words text-lg font-bold">{page.word}</p><Popover open={choosing} onOpenChange={setChoosing}><PopoverTrigger asChild><Button variant="ghost" disabled={draft.locked} className="min-h-11 shrink-0">换词</Button></PopoverTrigger><PopoverContent className="w-96 max-w-[calc(100vw-2rem)]" collisionPadding={12}>{choices}</PopoverContent></Popover></div>}
    {page.kind !== "text" ? <DrawingCanvas data={page} onChange={(drawing) => draft.change({ ...page, ...drawing })} disabled={draft.locked || (page.kind === "opening" && !page.word)} /> : <>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900" aria-label="字数提示">{task.hintLength === null ? "上一棒没有留下词语，凭想象猜吧" : `提示：${task.hintLength} 个字`}</p>
      <label className="grid gap-2 text-sm font-medium">你的猜测
        <textarea aria-label="你的猜测" aria-describedby="guess-length" aria-invalid={wrongLength && length > 0} className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-relaxed text-slate-900 outline-offset-2 focus-visible:outline-2" maxLength={80} value={page.text} disabled={draft.locked} onChange={(event) => draft.change({ kind: "text", text: event.target.value })} placeholder="大胆猜，猜歪了更有意思" />
      </label>
      <p id="guess-length" aria-live="polite" className={wrongLength ? "text-sm text-amber-800" : "text-sm text-slate-600"}>{task.hintLength === null ? `已输入 ${length} 个字，字数不限（最多 80 字）` : `已输入 ${length} / ${task.hintLength} 个字，字数相同才能交稿。`}{" 空白不计，标点计字。"}{wrongLength && "超时仍不符会记为缺页。"}</p>
    </>}
    {page.kind === "opening" && !page.word && <div className="shrink-0">{choices}</div>}
    <div className="shrink-0">
      <Button className="h-11 w-full" disabled={empty || wrongLength || draft.submitting} onClick={() => void draft.submit()}>{draft.submitting ? "正在交稿…" : draft.locked ? "重试提交" : "完成并提交"}</Button>
    </div>
    {draft.submitError && <p role="alert" className="break-words text-sm text-red-700">{draft.submitError}</p>}
  </section>;
}
