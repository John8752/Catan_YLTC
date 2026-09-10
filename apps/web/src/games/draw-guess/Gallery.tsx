import { useEffect, useRef, useState } from "react";
import { REVEAL_INTERVAL_MS, type DrawGuessRoomView } from "@catan/protocol/draw-guess";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { PlayerSession } from "../../room-session.js";
import { Button } from "../../components/ui/button.js";
import { Deadline } from "./DrawWork.js";
import { useReactions } from "./use-reactions.js";
import { HostBubble, RevealEntry } from "./RevealEntry.js";

export function Gallery({ room, session, onRoom, isHost, busy, onReplay }: { readonly room: DrawGuessRoomView; readonly session: PlayerSession; readonly onRoom: (room: AnyRoomView) => void; readonly isHost: boolean; readonly busy: boolean; readonly onReplay: () => void }) {
  const game = room.game!;
  const reactions = useReactions(session, game.id, onRoom);
  const revealCursor = game.phase.kind === "reveal" ? game.phase.cursor : null;
  const [albumIndex, setAlbumIndex] = useState(Math.max(0, game.albums.length - 1));
  const newest = useRef<HTMLElement>(null);
  useEffect(() => { if (revealCursor !== null) setAlbumIndex(Math.max(0, game.albums.length - 1)); }, [revealCursor, game.albums.length]);
  useEffect(() => { if (revealCursor !== null) newest.current?.scrollIntoView({ block: "start", behavior: "auto" }); }, [revealCursor, albumIndex]);
  const album = game.albums[Math.min(albumIndex, game.albums.length - 1)];
  const name = (id: string) => game.players.find((m) => m.id === id)?.name ?? "朋友";
  const finished = game.phase.kind === "finished";
  return <section className="grid min-w-0 gap-4" aria-label="画册揭晓">
    <header className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-2xl font-bold">{finished ? "本场画册已全部揭晓" : "准备好了？一起揭晓！"}</h2>
      <p className="mt-2 text-sm text-slate-600">{finished ? `${game.albums.length} 本画册，${game.totalSteps ** 2} 次脑洞。点选画册，重温整条接力。` : `系统主持人每 ${REVEAL_INTERVAL_MS / 1000} 秒自动翻一页，大家一起看接力。`}</p>
      <p className="mt-2 text-sm text-slate-600">每页都能 👍 点赞或 👎 喝倒彩，可以连点，按点击次数累计。</p>
    </header>
    {game.albums.length > 0 && <div className="flex flex-wrap gap-2" aria-label="选择画册">{game.albums.map((item, index) => <Button key={item.ownerId} variant={index === albumIndex ? "default" : "outline"} className="h-auto min-h-10 max-w-full whitespace-normal break-all" aria-pressed={index === albumIndex} onClick={() => setAlbumIndex(index)}>{name(item.ownerId)} 的画册</Button>)}</div>}
    {album && <div className="grid min-w-0 gap-6 rounded-3xl border border-stone-200 bg-[#faf7ef] p-3 sm:p-5" aria-label={`${name(album.ownerId)} 的接力`}>
      <HostBubble>{`现在打开 ${name(album.ownerId)} 的画册，跟着每一棒回看！`}</HostBubble>
      {album.pages.map((page, index) => <article key={page.step} ref={index === album.pages.length - 1 ? newest : undefined} className="grid min-w-0 scroll-mt-3 gap-4" aria-label={`第 ${index + 1} 页`}>
        <RevealEntry page={page} name={name(page.authorId)} own={page.authorId === game.you.id} playerIndex={Math.max(0, game.players.findIndex((player) => player.id === page.authorId))}
          live={!finished && index === album.pages.length - 1} onReact={(reaction) => reactions.react(album.ownerId, page.step, reaction)} />
      </article>)}
    </div>}
    {reactions.pending > 0 && <p role="status" className="text-sm text-slate-600">还有 {reactions.pending} 次表态正在确认…</p>}
    {reactions.error && <div className="grid gap-2"><p role="alert" className="text-sm text-red-700">{reactions.error}</p><Button variant="outline" className="min-h-11" onClick={reactions.retry}>重试表态</Button></div>}
    <div role="region" aria-label="系统主持人串词" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm text-amber-900">系统主持人</strong>{!finished && <Deadline game={game} />}</div>
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-relaxed text-slate-800">{finished || !album ? game.narration : revealCursor === game.totalSteps ** 2 ? "最后一棒也揭晓啦，马上打开完整画册。" : "下一棒马上来，看看故事怎么接！"}</p>
      {finished ? isHost ? <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onReplay}>回到房间，再来一局</Button> : <p className="text-sm">这局结束啦，等待房主开启下一局。</p>
        : null}
    </div>
  </section>;
}
