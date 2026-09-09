import { useEffect, useRef, useState } from "react";
import type { DrawGuessRoomView } from "@catan/protocol/draw-guess";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { PageDisplay } from "./DrawWork.js";

export function Gallery({ room, isHost, busy, onReveal, onReplay }: { readonly room: DrawGuessRoomView; readonly isHost: boolean; readonly busy: boolean; readonly onReveal: () => void; readonly onReplay: () => void }) {
  const game = room.game!;
  const [albumIndex, setAlbumIndex] = useState(Math.max(0, game.albums.length - 1));
  const newest = useRef<HTMLDivElement>(null);
  useEffect(() => { if (game.phase.kind === "reveal") setAlbumIndex(Math.max(0, game.albums.length - 1)); }, [game.phase, game.albums.length]);
  useEffect(() => { if (game.phase.kind === "reveal") newest.current?.scrollIntoView({ block: "nearest" }); }, [game.phase]);
  const album = game.albums[Math.min(albumIndex, game.albums.length - 1)];
  const name = (id: string) => game.players.find((m) => m.id === id)?.name ?? "朋友";
  const finished = game.phase.kind === "finished";
  return <section className="grid min-w-0 gap-4" aria-label="画册揭晓">
    <header className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-2xl font-bold">{finished ? "这一轮，画得太离谱了" : "准备好了？一起揭晓！"}</h2>
      <p className="mt-2 text-sm text-slate-600">{finished ? `${game.albums.length} 本画册，${game.totalSteps ** 2} 次脑洞。点选画册，重温整条接力。` : "房主每次翻一页。先聊聊这幅画，再看下一位怎么猜。"}</p>
    </header>
    {game.albums.length > 0 && <div className="flex flex-wrap gap-2" aria-label="选择画册">{game.albums.map((item, index) => <Button key={item.ownerId} variant={index === albumIndex ? "default" : "outline"} className="h-auto min-h-10 max-w-full whitespace-normal break-all" aria-pressed={index === albumIndex} onClick={() => setAlbumIndex(index)}>{name(item.ownerId)} 的画册</Button>)}</div>}
    {album && <div className="grid min-w-0 gap-4" aria-label={`${name(album.ownerId)} 的接力`}>
      {album.pages.map((page, index) => <article key={page.step} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label={`第 ${index + 1} 页`}>
        <header className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="break-all">{index + 1}. {name(page.authorId)}</strong><span className={cn("rounded-full px-2 py-1 text-xs", page.timedOut ? "bg-slate-100 text-slate-600" : "bg-green-50 text-green-800")}>{page.timedOut ? "超时收稿" : page.content.kind === "drawing" ? "画出来" : index === 0 ? "最初的词" : "猜出来"}</span></header>
        <PageDisplay content={page.content} />
      </article>)}
    </div>}
    <div ref={newest} className="sticky bottom-0 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {finished ? isHost ? <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onReplay}>回到房间，再来一局</Button> : <p className="text-sm">这局结束啦，等待房主开启下一局。</p>
        : isHost ? <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={onReveal}>{game.albums.length === 0 ? "揭晓第一页" : "揭晓下一页"}</Button> : <p role="status" className="text-sm">等待房主揭晓下一页…</p>}
    </div>
  </section>;
}
