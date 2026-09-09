import { useEffect, useState } from "react";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { DrawGuessView } from "@catan/protocol/draw-guess";
import type { PageContent } from "@catan/game-core/draw-guess";
import type { PlayerSession } from "../../room-session.js";
import { Button } from "../../components/ui/button.js";
import { DrawingCanvas, DrawingPreview } from "./DrawingCanvas.js";
import { useDraft } from "./use-draft.js";

export function Deadline({ game }: { readonly game: DrawGuessView }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const deadline = game.deadline; if (!deadline) return;
    const end = Date.now() + deadline.deadlineAt - deadline.serverNow;
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [game.deadline]);
  if (!game.deadline) return null;
  return <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-sm font-bold text-amber-900" role="timer" aria-label="本轮剩余时间">{remaining > 0 ? `${remaining} 秒` : "正在收稿…"}</span>;
}
export function PageDisplay({ content }: { readonly content: PageContent }) {
  return content.kind === "drawing" ? <DrawingPreview strokes={content.strokes} />
    : content.kind === "text" ? <p className="break-words rounded-xl bg-amber-50 p-4 text-center text-xl font-bold text-slate-900">{content.text}</p>
      : <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-slate-600">这一页没赶上交稿，凭想象继续吧。</div>;
}
export function DrawWork({ game, session, onRoom }: { readonly game: DrawGuessView; readonly session: PlayerSession; readonly onRoom: (room: AnyRoomView) => void }) {
  const task = game.task!;
  const draft = useDraft(session, game, task, onRoom);
  const empty = draft.page.kind === "text" ? draft.page.text.trim().length === 0 : draft.page.strokes.length === 0;
  if (task.submitted) return <section className="grid min-h-64 place-content-center gap-3 rounded-2xl border bg-white p-6 text-center" aria-label="等待其他玩家">
    <span className="text-4xl" aria-hidden="true">✓</span><h2 className="text-2xl font-bold">交稿成功！</h2>
    <p>还有 {game.progress.filter((p) => !p.submitted).length} 位朋友正在创作。</p><p className="text-sm text-slate-500">先别剧透，等会儿一起揭晓。</p>
  </section>;
  return <section className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="本轮任务">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{task.step === 0 ? "写一句让朋友画的话" : task.kind === "drawing" ? "把这句话画出来" : "这幅画在说什么？"}</h2><Deadline game={game} /></div>
    {task.input && <PageDisplay content={task.input} />}
    {task.kind === "drawing" && draft.page.kind === "drawing" ? <DrawingCanvas strokes={draft.page.strokes} onChange={(strokes) => draft.change({ kind: "drawing", strokes })} disabled={draft.locked} /> : <>
      {task.suggestions.length > 0 && <div className="flex flex-wrap gap-2" aria-label="灵感词语">{task.suggestions.map((text) => <Button key={text} variant="outline" className="h-auto min-h-10 whitespace-normal text-left" disabled={draft.locked} onClick={() => draft.change({ kind: "text", text })}>{text}</Button>)}</div>}
      <label className="grid gap-2 text-sm font-medium">{task.step === 0 ? "你的词语" : "你的猜测"}
        <textarea aria-label={task.step === 0 ? "你的词语" : "你的猜测"} className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-relaxed text-slate-900 outline-offset-2 focus-visible:outline-2" maxLength={80} value={draft.page.kind === "text" ? draft.page.text : ""} disabled={draft.locked} onChange={(event) => draft.change({ kind: "text", text: event.target.value })} placeholder={task.step === 0 ? "选个灵感，或者自己编一句（最多 80 字）" : "大胆猜，猜歪了更有意思"} />
      </label>
    </>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500" role="status">{draft.saveStatus}</p>
      <Button className="min-h-11 flex-1 sm:flex-none" disabled={empty || draft.submitting} onClick={() => void draft.submit()}>{draft.submitting ? "正在交稿…" : draft.locked ? "重试提交" : "完成并提交"}</Button>
    </div>
    {draft.submitError && <p role="alert" className="break-words text-sm text-red-700">{draft.submitError}</p>}
    <p className="text-xs leading-relaxed text-slate-500">交稿后不能修改。超时会提交已保存的草稿；请不要在语音里说出当前词语。</p>
  </section>;
}
