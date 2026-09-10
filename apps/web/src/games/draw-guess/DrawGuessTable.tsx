import { useLayoutEffect, type ReactNode } from "react";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { DrawGuessRoomView, DrawGuessSettings } from "@catan/protocol/draw-guess";
import { getRoom, shuffleRoomMembers } from "../../api.js";
import { type PlayerSession } from "../../room-session.js";
import { Button } from "../../components/ui/button.js";
import { DisbandRoomControl } from "../../components/DisbandRoomControl.js";
import { saveDrawSettings } from "./api.js";
import { DrawWork } from "./DrawWork.js";
import { Gallery } from "./Gallery.js";
import { cn } from "../../lib/utils.js";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog.js";

interface Props {
  readonly room: DrawGuessRoomView; readonly session: PlayerSession; readonly busy: boolean; readonly error: string | null;
  readonly connectionState: "connecting" | "live" | "offline"; readonly accountControl: ReactNode;
  readonly setRoom: (room: AnyRoomView) => void; readonly runBusy: (action: () => Promise<void>) => Promise<void>;
  readonly handleStart: () => Promise<void>; readonly handleLeave: () => Promise<void>; readonly handleDisband: () => Promise<void>; readonly onReturnToLobby: () => Promise<void>;
}
export function DrawGuessTable({ room, session, busy, error, connectionState, accountControl, setRoom, runBusy, handleStart, handleLeave, handleDisband, onReturnToLobby }: Props) {
  const isHost = room.hostPlayerId === session.playerId, game = room.game;
  const working = game?.phase.kind === "work";
  const drawing = working && game.task?.kind !== "text";
  useLayoutEffect(() => { if (working) window.scrollTo(0, 0); }, [working, game?.task?.id]);
  async function settings(next: DrawGuessSettings) {
    await runBusy(async () => { try { setRoom(await saveDrawSettings(session, room.revision, next)); } catch (error) { setRoom(await getRoom(session)); throw error; } });
  }
  const players = <section className="rounded-2xl border border-slate-200 bg-white p-3" aria-label="房间玩家">
    <ul className="grid grid-cols-3 gap-2">{room.members.map((member) => <li key={member.id} className={cn("min-w-0 rounded-lg px-2 py-2 text-center text-sm", member.id === session.playerId ? "bg-amber-100" : "bg-slate-100")}><span className="block truncate font-medium" title={member.name}>{member.name}</span><small className="text-slate-600">{working ? game.progress.find((p) => p.playerId === member.id)?.submitted ? "已交稿 ✓" : "创作中" : member.isHost ? "房主" : "已入座"}</small></li>)}</ul>
  </section>;
  const controls = <div className="flex flex-wrap items-center justify-between gap-3">{accountControl}<div className="flex flex-wrap gap-2">{!game || game.phase.kind === "finished" ? <Button variant="outline" disabled={busy} onClick={() => void handleLeave()}>离开房间</Button> : null}{isHost && <DisbandRoomControl room={room} busy={busy} onDisband={handleDisband} />}</div></div>;
  return <main className={cn("bg-[#f5f1e9] px-[max(.5rem,env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(.5rem,env(safe-area-inset-bottom))] pt-[max(.5rem,env(safe-area-inset-top))] text-slate-900", drawing ? "h-dvh" : "min-h-svh")}>
    <div className={cn("mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3", drawing && "h-full min-h-0 gap-2")}>
      {game ? <header className="flex shrink-0 items-center justify-between gap-2">
        <div><h1 className="text-sm font-bold">传画猜词{working && <span className="ml-2 font-normal text-slate-600">第 {game.phase.step + 1} / {game.totalSteps} 轮</span>}</h1>{connectionState !== "live" && <p role="status" className="text-xs text-amber-800">{connectionState === "connecting" ? "正在重连…" : "离线 · 草稿仍可编辑"}</p>}</div>
        <Dialog><DialogTrigger asChild><Button variant="ghost" className="min-h-11 px-2 text-xs">{working ? `${game.progress.filter((p) => p.submitted).length}/${room.members.length} 已交稿 · 房间` : "房间信息"}</Button></DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>房间信息</DialogTitle><DialogDescription>房间码 {room.id} · {connectionState === "live" ? "已连接" : "连接恢复中"}</DialogDescription></DialogHeader>{players}{controls}</DialogContent>
        </Dialog>
      </header> : <>
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div><p className="text-xs tracking-widest text-slate-500">YLTC 桌游小馆</p><h1 className="text-xl font-black">传画猜词</h1></div>
        <div className="text-right"><p className="font-mono text-lg font-bold" aria-label="房间码">{room.id}</p><p className={cn("text-xs", connectionState === "live" ? "text-green-700" : "text-amber-800")}>{connectionState === "live" ? "已连接" : connectionState === "connecting" ? "正在重连…" : "离线 · 草稿仍可编辑"}</p></div>
      </header>
      <p className="text-sm font-bold">等待朋友加入 · {room.members.length}/6 人</p>
      {players}
      </>}
      {!game ? <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5" aria-label="传画猜词房间设置">
        <div><h2 className="text-xl font-bold">一句话能传得多离谱？</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">系统主持人：大家好！每人从六个词里选一个，自己先画；下一位看图猜词，有字数提示，再传给朋友画。所有人同时进行，最后由我自动翻画册，带大家回顾脑洞名场面。</p></div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-medium">猜词时间<select aria-label="猜词时间" className="h-11 w-full rounded-lg border bg-white px-2" disabled={!isHost || busy} value={room.settings.textSeconds} onChange={(e) => void settings({ ...room.settings, textSeconds: Number(e.target.value) as DrawGuessSettings["textSeconds"] })}>{[30, 60, 90].map((seconds) => <option key={seconds} value={seconds}>{seconds} 秒</option>)}</select></label>
          <label className="grid gap-2 text-sm font-medium">画画时间<select aria-label="画画时间" className="h-11 w-full rounded-lg border bg-white px-2" disabled={!isHost || busy} value={room.settings.drawingSeconds} onChange={(e) => void settings({ ...room.settings, drawingSeconds: Number(e.target.value) as DrawGuessSettings["drawingSeconds"] })}>{[60, 90, 120].map((seconds) => <option key={seconds} value={seconds}>{seconds} 秒</option>)}</select></label>
        </div>
        <p className="text-sm text-slate-500">房间固定为传画猜词，需要 3–6 人。超时自动收稿；语音聊天请使用你们已有的软件。</p>
        {isHost ? <div className="flex flex-wrap gap-2"><Button className="min-h-11 flex-1" disabled={busy || room.members.length < 3} onClick={() => void handleStart()}>开始传画猜词</Button><Button className="min-h-11" variant="outline" disabled={busy || room.members.length < 2} onClick={() => void runBusy(async () => setRoom(await shuffleRoomMembers(session, room.revision)))}>打乱座位</Button></div> : <p role="status" className="text-center">等待房主开始…</p>}
      </section> : game.phase.kind === "work" && game.task ? <DrawWork key={game.task.id} game={game} session={session} onRoom={setRoom} /> : <Gallery key={game.id} room={room} session={session} onRoom={setRoom} isHost={isHost} busy={busy} onReplay={() => void onReturnToLobby()} />}
      {error && <p role="alert" className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!game && <footer className="border-t border-slate-300 pt-4">{controls}</footer>}
    </div>
  </main>;
}
