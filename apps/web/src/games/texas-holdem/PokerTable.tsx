import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Menu, Palette } from "lucide-react";
import type { AnyRoomView } from "@catan/protocol/platform";
import type { PokerAction, PokerRoomView, PokerSettings, PokerView } from "@catan/protocol/texas-holdem";
import { Button } from "../../components/ui/button.js";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../components/ui/dialog.js";
import { DisbandRoomControl } from "../../components/DisbandRoomControl.js";
import { getRoom, shuffleRoomMembers } from "../../api.js";
import type { PlayerSession } from "../../room-session.js";
import { randomId } from "../../lib/random-id.js";
import { cn } from "../../lib/utils.js";
import { sendPokerCommand, savePokerSettings } from "./api.js";
import { PokerLobby } from "./PokerLobby.js";
import { PokerActions } from "./PokerActions.js";
import { PokerResults } from "./PokerResults.js";
import { PokerPlayfield } from "./PokerPlayfield.js";
import { pokerSeatPositions } from "./seat-layout.js";
import { usePokerMotion } from "./use-poker-motion.js";
import type { RoomUpdates } from "../../room-updates.js";
import { confirmRoomCommand } from "../../lib/command-confirmation.js";
interface Props {
  updates: RoomUpdates;
  room: PokerRoomView; session: PlayerSession; busy: boolean; error: string | null; connectionState: "connecting" | "live" | "offline"; accountControl: ReactNode; snapshotEpoch: number;
  setRoom: (r: AnyRoomView) => void; runBusy: (fn: () => Promise<void>) => Promise<void>; handleStart: () => Promise<void>; handleLeave: () => Promise<void>; handleDisband: () => Promise<void>; onReturnToLobby: () => Promise<void>;
}
function useRemaining(game: PokerView | null) {
  const d = game?.deadline, [remaining, setRemaining] = useState(0);
  useEffect(() => { if (!d) { setRemaining(0); return; } const until = Date.now() + Math.max(0, d.deadlineAt - d.serverNow); const tick = () => setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000))); tick(); const timer = window.setInterval(tick, 250); return () => window.clearInterval(timer); }, [d?.deadlineAt, d?.serverNow]);
  return remaining;
}
export function PokerTable({ updates, room, session, busy, error, connectionState, accountControl, snapshotEpoch, setRoom, runBusy, handleStart, handleLeave, handleDisband, onReturnToLobby }: Props) {
  const game = room.game, host = room.hostPlayerId === session.playerId, remaining = useRemaining(game), stage = useRef<HTMLDivElement>(null), [height, setHeight] = useState(600);
  const [skin, setSkin] = useState<"green" | "midnight">("green"), [results, setResults] = useState(false);
  const points = pokerSeatPositions(game?.players.map((p) => p.id) ?? [], session.playerId, height);
  useLayoutEffect(() => { const root = stage.current; if (!root) return; const measure = () => setHeight(root.getBoundingClientRect().height); measure(); const observer = new ResizeObserver(measure); observer.observe(root); return () => observer.disconnect(); }, [game?.id]);
  usePokerMotion(stage, game, snapshotEpoch);
  useEffect(() => setResults(false), [game?.handNumber, game?.id]);
  const connected = connectionState === "live", finished = game?.phase.kind === "finished", acting = game?.phase.kind === "betting" && game.phase.actorId === session.playerId;
  const actorId = game?.phase.kind === "betting" ? game.phase.actorId : null, actorName = game?.players.find((p) => p.id === actorId)?.name ?? "玩家";
  async function refreshOnError(fn: () => Promise<PokerRoomView>) { await runBusy(async () => { try { setRoom(await fn()); } catch (e) { try { setRoom(await getRoom(session)); } catch { /* Connection banner handles recovery. */ } throw e; } }); }
  async function action(a: PokerAction | { type: "next-hand" }) {
    if (!game) return;
    const commandId = randomId();
    await runBusy(async () => {
      try { await confirmRoomCommand(updates, session, await sendPokerCommand(session, commandId, { matchId: game.id, handNumber: game.handNumber, expectedRevision: game.revision, action: a }), { gameId: "texas-holdem", matchId: game.id, commandId, connected }); }
      catch (error) { try { setRoom(await getRoom(session)); } catch { /* Connection banner handles recovery. */ } throw error; }
    });
  }
  async function settings(s: PokerSettings) { await refreshOnError(() => savePokerSettings(session, room.revision, s)); }
  return <main className={cn("flex min-h-dvh flex-col bg-[#081c16] px-[max(.5rem,env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(.5rem,env(safe-area-inset-bottom))] pt-[max(.25rem,env(safe-area-inset-top))] text-[#e7eee3] selection:bg-[#d7bd83] selection:text-[#10291f]", game && "h-dvh min-h-[540px] overflow-hidden")}>
    <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center gap-2">
      <Dialog><DialogTrigger asChild><Button size="icon" variant="ghost" className="size-11 text-[#d3dfd2] hover:bg-[#244132] hover:text-white" aria-label="房间信息"><Menu /></Button></DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-[#58725b] bg-[#10291f] text-[#e7eee3]"><DialogHeader><DialogTitle>德州扑克房间</DialogTitle><DialogDescription className="text-[#b6c8b8]">房间码 {room.id} · {room.members.length}/9 人 · 虚拟筹码</DialogDescription></DialogHeader>
          <p className="text-sm leading-relaxed">牌型由大到小：同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌。两张底牌与五张公共牌组成最佳五张，花色不分高低。</p>
          <p className="text-sm leading-relaxed">输入加注为本轮总额。全下按主池和边池分别分配；超时能过则过，否则弃牌。刷新可恢复座位。</p>
          <ul className="grid grid-cols-2 gap-2 text-xs" aria-label="房间玩家">{room.members.map((m, i) => <li key={m.id} className="min-w-0 break-words rounded-lg bg-[#224333] p-2">座位 {i + 1} · {m.name}{m.isHost ? " · 房主" : ""}</li>)}</ul>
          <div className="rounded-lg bg-[#e6e6d8] p-2 text-[#163829]">{accountControl}</div>{(!game || finished) && <Button variant="outline" disabled={busy} onClick={() => void handleLeave()}>离开房间</Button>}{host && <DisbandRoomControl room={room} busy={busy} onDisband={handleDisband} />}
        </DialogContent>
      </Dialog>
      <div className="min-w-0 flex-1"><h1 className="text-sm font-semibold">德州扑克 <span className="ml-1 text-[10px] font-normal text-[#a6bcaa]">{room.settings.mode === "tournament" ? "锦标赛" : "固定手数"}</span></h1><p className="text-[10px] text-[#a6bcaa]">{game ? `第 ${game.handNumber}${room.settings.mode === "fixed-hands" ? ` / ${room.settings.handLimit}` : ""} 手 · 盲注 ${game.smallBlind}/${game.bigBlind}` : "朋友局 · 仅使用虚拟筹码"}</p></div>
      <span className="font-mono text-xs text-[#c2d2bf]" aria-label="房间码">{room.id}</span><Button variant="ghost" size="icon" aria-label="切换牌桌配色" title={skin === "green" ? "切换曜石黑" : "切换翡翠绿"} className="size-11 text-[#d3dfd2] hover:bg-[#244132] hover:text-white" onClick={() => setSkin((s) => s === "green" ? "midnight" : "green")}><Palette /></Button>
    </header>
    {!connected && <p role="status" className="mx-auto w-full max-w-3xl shrink-0 rounded-lg bg-[#e3c78d] px-3 py-1.5 text-xs text-[#332c1d]">{connectionState === "connecting" ? "正在重连…" : "连接中断，正在恢复…"}超时自动过牌或弃牌。</p>}
    {error && <p role="alert" className="mx-auto w-full max-w-3xl shrink-0 break-words rounded-lg bg-[#f5d4bc] px-3 py-2 text-xs text-[#842f21]">{error}</p>}
    {!game ? <div className="mx-auto mt-4 w-full max-w-3xl pb-6"><PokerLobby room={room} host={host} busy={busy || !connected} onSettings={settings} onStart={handleStart} onShuffle={() => runBusy(async () => setRoom(await shuffleRoomMembers(session, room.revision)))} /></div> : <>
      <PokerPlayfield room={room} game={game} viewerId={session.playerId} stageRef={stage} points={points} remaining={remaining} skin={skin} onResults={() => setResults(true)} />
      <footer className="mx-auto w-full max-w-2xl shrink-0 space-y-1.5 px-2 pt-1.5">
        <div className="flex min-h-5 items-center justify-between gap-2 text-[11px] text-[#b9cdbb]"><p className="min-w-0 truncate" aria-live="polite">{game.phase.kind === "betting" ? acting ? "轮到你行动" : `等待 ${actorName} 行动` : finished ? "本局结算已完成" : `${remaining} 秒后自动发下一手`}</p><span className="shrink-0 tabular-nums" aria-label="剩余行动时间">{game.phase.kind === "betting" ? `${remaining} 秒` : ""}</span></div>
        {acting ? <PokerActions game={game} busy={busy || !connected} onAction={action} /> : game.phase.kind === "betting" ? <div className="flex min-h-12 items-center justify-center text-xs text-[#8da890]">{game.players.find((p) => p.id === session.playerId)?.folded ? "本手已弃牌，等待下一手" : "底牌仅你可见 · 请等待轮到你"}</div>
          : <div className="flex min-h-12 items-center justify-center gap-3">{host ? <Button className="min-h-12 min-w-44 rounded-full bg-[#d8b979] font-bold text-[#322719] hover:bg-[#ecd298]" disabled={busy || !connected} onClick={() => void (finished ? onReturnToLobby() : action({ type: "next-hand" }))}>{finished ? "返回大厅再来一局" : "发下一手"}</Button> : <p className="text-xs text-[#b9cdbb]">{finished ? "等待房主再来一局" : "即将开始下一手"}</p>}</div>}
      </footer>
      <Dialog open={results} onOpenChange={setResults}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-[#58725b] bg-[#10291f] text-[#e7eee3]"><DialogHeader><DialogTitle>{finished ? "最终排名" : "本手结算"}</DialogTitle><DialogDescription className="text-[#adc3ae]">第 {game.handNumber} 手 · 各底池独立结算</DialogDescription></DialogHeader><PokerResults game={game} />
        {finished && <section aria-label="最终排名"><h2 className="mb-3 font-bold">最终排名</h2><ol className="space-y-2">{game.standings.map((p) => <li key={p.playerId} className="flex items-center gap-3 border-b border-[#77987e]/25 pb-2 text-sm"><span className="text-[#e6c784]">第 {p.rank} 名</span><span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span><strong className="tabular-nums">{p.chips}</strong></li>)}</ol></section>}
      </DialogContent></Dialog>
    </>}
  </main>;
}
