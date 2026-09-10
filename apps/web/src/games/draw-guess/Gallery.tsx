import { useLayoutEffect, useRef, useState } from "react";
import { REVEAL_INTERVAL_MS, type DrawGuessRoomView } from "@catan/protocol/draw-guess";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { PlayerSession } from "../../room-session.js";
import { Button } from "../../components/ui/button.js";
import { Deadline } from "./DrawWork.js";
import { useReactions } from "./use-reactions.js";
import { RevealEntry } from "./RevealEntry.js";

function followEntry(target: HTMLElement | null, immediate: boolean) {
  if (!target) return;
  target.focus({ preventScroll: true });
  const bounds = target.getBoundingClientRect();
  const behavior = immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  if (bounds.height > window.innerHeight - 24 || bounds.top < 12) target.scrollIntoView({ block: "start", behavior });
  else if (bounds.bottom > window.innerHeight - 12) target.scrollIntoView({ block: "end", behavior });
}

export function Gallery({ room, session, onRoom, isHost, busy, onReplay }: { readonly room: DrawGuessRoomView; readonly session: PlayerSession; readonly onRoom: (room: AnyRoomView) => void; readonly isHost: boolean; readonly busy: boolean; readonly onReplay: () => void }) {
  const game = room.game!;
  const reactions = useReactions(session, game.id, onRoom);
  const revealCursor = game.phase.kind === "reveal" ? game.phase.cursor : null;
  const finished = game.phase.kind === "finished";
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const albums = finished && selectedOwner ? game.albums.filter((album) => album.ownerId === selectedOwner) : game.albums;
  const newest = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const completion = useRef<HTMLDivElement>(null);
  const previous = useRef<{ cursor: number | null; selectedOwner: string | null; finished: boolean } | null>(null);
  useLayoutEffect(() => {
    const before = previous.current;
    if (before?.cursor === revealCursor && before?.selectedOwner === selectedOwner && before?.finished === finished) return;
    previous.current = { cursor: revealCursor, selectedOwner, finished };
    if ((before && before.selectedOwner !== selectedOwner) || (!before && (finished || !revealCursor))) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (finished) followEntry(completion.current, false);
    else followEntry(newest.current, !before);
  }, [revealCursor, selectedOwner, finished]);
  const name = (id: string) => game.players.find((m) => m.id === id)?.name ?? "朋友";
  return <section className="grid min-w-0 gap-4" aria-label="画册揭晓">
    <header className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">{finished ? "本场画册已全部揭晓" : "准备好了？一起揭晓！"}</h2>
      <p className="mt-2 text-sm text-slate-600">系统主持人每 {REVEAL_INTERVAL_MS / 1000} 秒揭晓一棒，沿着下方一起看接力。</p>
      <p className="mt-2 text-sm text-slate-600">每页都能 👍 点赞或 👎 喝倒彩，可以连点，按点击次数累计。</p>
    </header>
    {albums.map((album, albumIndex) => <div key={album.ownerId} data-album-owner={album.ownerId} className="grid min-w-0 gap-6 rounded-3xl border border-stone-200 bg-[#faf7ef] p-3 sm:p-5" aria-label={`${name(album.ownerId)} 的接力`}>
      <h3 className="break-words text-lg font-bold text-amber-900">{name(album.ownerId)} 的画册</h3>
      {album.pages.map((page, index) => {
        const latest = albumIndex === albums.length - 1 && index === album.pages.length - 1;
        return <article key={page.step} tabIndex={-1} ref={latest ? newest : undefined} className="grid min-w-0 scroll-my-3 content-start gap-4 outline-none" aria-label={`第 ${index + 1} 页`}>
          <RevealEntry page={page} name={name(page.authorId)} own={page.authorId === game.you.id} playerIndex={Math.max(0, game.players.findIndex((player) => player.id === page.authorId))}
            live={!finished && latest} onReact={(reaction) => reactions.react(album.ownerId, page.step, reaction)} />
        </article>;
      })}
    </div>)}
    {reactions.pending > 0 && <p role="status" className="text-sm text-slate-600">还有 {reactions.pending} 次表态正在确认…</p>}
    {reactions.error && <div className="grid gap-2"><p role="alert" className="text-sm text-red-700">{reactions.error}</p><Button variant="outline" className="min-h-11" onClick={reactions.retry}>重试表态</Button></div>}
    <div ref={completion} tabIndex={-1} role="region" aria-label="系统主持人串词" className="grid scroll-my-3 gap-3 rounded-xl border border-slate-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] outline-none">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm text-amber-900">系统主持人</strong>{!finished && <Deadline game={game} />}</div>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-relaxed text-slate-800">{finished || !albums.length ? game.narration : revealCursor === game.totalSteps ** 2 ? "最后一棒也揭晓啦，马上打开完整画册。" : "下一棒马上来，看看故事怎么接！"}</p>
      {finished && <>
        <p className="text-sm text-slate-600">{game.albums.length} 本画册，{game.totalSteps ** 2} 次脑洞。点选画册，重温整条接力。</p>
        <div className="flex flex-wrap gap-2" aria-label="选择画册">{game.albums.map((album) => <Button key={album.ownerId} variant={album.ownerId === selectedOwner ? "default" : "outline"} className="h-auto min-h-10 max-w-full whitespace-normal break-all" aria-pressed={album.ownerId === selectedOwner} onClick={() => setSelectedOwner(album.ownerId)}>{name(album.ownerId)} 的画册</Button>)}<Button variant={selectedOwner === null ? "default" : "outline"} className="min-h-10" aria-pressed={selectedOwner === null} onClick={() => setSelectedOwner(null)}>全部画册</Button></div>
        {isHost ? <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onReplay}>回到房间，再来一局</Button> : <p className="text-sm">这局结束啦，等待房主开启下一局。</p>}
      </>}
    </div>
  </section>;
}
