import { CAMEL_UP_PLAYER_LIMITS } from "@catan/game-core/camel-up";
import { ActionFlight } from "./ActionFlight.js";
import "./typography.css";
import { useRaceFeedback } from "./use-race-feedback.js";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Coins, Dices, Flag, Trophy, Users } from "lucide-react";
import type { CamelAction } from "@catan/game-core/camel-up";
import type { AnyRoomView } from "@catan/protocol/platform";
import { CAMEL_NAMES, type CamelRoomView } from "@catan/protocol/camel-up";
import type { PlayerSession } from "../../room-session.js";
import { getRoom } from "../../api.js";
import { randomId } from "../../lib/random-id.js";
import { cn } from "../../lib/utils.js";
import { Button } from "../../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog.js";
import { DisbandRoomControl } from "../../components/DisbandRoomControl.js";
import { useMediaQuery } from "../../hooks/use-media-query.js";
import { MobileRaceTable } from "./MobileRaceTable.js";
import { RaceBoard } from "./RaceBoard.js";
import { RaceActions } from "./RaceActions.js";
import { CamelPiece } from "./CamelPiece.js";
import { sendCamelCommand } from "./api.js";
import type { RoomUpdates } from "../../room-updates.js";
import { confirmRoomCommand } from "../../lib/command-confirmation.js";
interface Props {
  updates: RoomUpdates;
  snapshotEpoch: number; room: CamelRoomView; session: PlayerSession; busy: boolean; error: string | null;
  connectionState: "connecting" | "live" | "offline"; accountControl: ReactNode;
  setRoom: (room: AnyRoomView) => void; runBusy: (action: () => Promise<void>) => Promise<void>;
  handleStart: () => Promise<void>; handleLeave: () => Promise<void>; handleDisband: () => Promise<void>; onReturnToLobby: () => Promise<void>;
}
export function CamelTable({ updates, snapshotEpoch, room, session, busy, error, connectionState, accountControl, setRoom, runBusy, handleStart, handleLeave, handleDisband, onReturnToLobby }: Props) {
  const mobile = useMediaQuery("(max-width: 1023px)");
  const game = room.game, host = room.hostPlayerId === session.playerId, finished = game?.phase.kind === "finished";
  const actionOrigin = useRef<DOMRect | null>(null);
  const effect = useRaceFeedback(game, snapshotEpoch);
  const [tileMode, setTileMode] = useState<"cheer" | "boo" | null>(null);
  useEffect(() => setTileMode(null), [game?.revision]);
  const me = game?.players.find(p => p.id === session.playerId);
  const activeId = game?.phase.kind === "racing" ? game.phase.activePlayerId : null;
  const activeName = game?.players.find(p => p.id === activeId)?.name;
  const canAct = Boolean(game?.legal.roll && connectionState === "live" && !busy);
  function action(next: CamelAction) {
    if (!game || !canAct) return;
    actionOrigin.current = document.activeElement?.getBoundingClientRect() ?? null;
    const command = { ...next, matchId: game.id, expectedRevision: game.revision };
    void runBusy(async () => {
      try { const commandId = randomId(); await confirmRoomCommand(updates, session, await sendCamelCommand(session, commandId, command), { gameId: "camel-up", matchId: game.id, commandId, connected: connectionState === "live" }); }
      catch (error) { setRoom(await getRoom(session)); throw error; }
    });
  }
  const players = <ul className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3" aria-label="房间玩家">{room.members.map((member, index) => {
    const p = game?.players.find(p => p.id === member.id), active = game?.phase.kind === "racing" && game.phase.activePlayerId === member.id;
    return <li key={member.id} className={cn("flex min-w-0 items-center gap-2 rounded-lg p-2", active ? "bg-[#e1ba67] text-[#1b3934]" : "bg-white/5")}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-current/25 text-sm font-bold">{index + 1}</span><div className="min-w-0 flex-1"><strong title={member.name} className="block truncate text-sm">{member.name}{member.id === session.playerId ? "（你）" : ""}</strong><span className={cn("block text-sm", active ? "text-[#354c3d]" : "text-[#d0d9cc]")}>{p ? `${p.coins} 金币${p.partnerId ? " · 已合伙" : ""}` : member.isHost ? "房主" : "已入座"}</span></div>
    </li>;
  })}</ul>;
  const roomControls = <div className="flex flex-wrap items-center gap-2">{accountControl}{(!game || finished) && <Button variant="outline" disabled={busy} onClick={() => void handleLeave()}>离开房间</Button>}{host && <DisbandRoomControl room={room} busy={busy} onDisband={handleDisband} />}</div>;
  const roomMenu = <Dialog><DialogTrigger asChild><Button variant="ghost" className="h-11 text-[#f6ebce] hover:bg-white/10 hover:text-white"><Users />房间</Button></DialogTrigger><DialogContent className="camel-font max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>骆驼大赛 · {room.id}</DialogTitle><DialogDescription>房间码 {room.id} · 3–6 人 · {connectionState === "live" ? "已连接" : "连接恢复中"}</DialogDescription></DialogHeader><div className="rounded-xl bg-[#153b3d] p-3 text-[#f6ebce]">{players}</div>{roomControls}</DialogContent></Dialog>;
  if (mobile && game && !finished) return <><ActionFlight effect={effect?.playerId === session.playerId ? effect : null} origin={actionOrigin.current} /><MobileRaceTable effect={effect} game={game} playerId={session.playerId} roomMenu={roomMenu} rules={<Rules />} busy={busy} error={error} connectionState={connectionState} onAction={action} tileMode={tileMode} onTileMode={setTileMode} /></>;
  return <main className="camel-font min-h-svh bg-[#153b3d] px-[max(.75rem,env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(.75rem,env(safe-area-inset-top))] text-[#f6ebce] selection:bg-[#e3b557] selection:text-[#173a39]">
    <ActionFlight effect={effect?.playerId === session.playerId ? effect : null} origin={actionOrigin.current} />
    <div className="mx-auto max-w-[1440px]">
      <header className="mb-5 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#e3b557] text-[#173a39]"><CamelPiece camel="green" className="size-9" /></span><div><h1 className="mb-0 text-xl font-extrabold tracking-tight sm:text-2xl">骆驼大赛</h1><span className="text-sm text-[#c1d1c6]">YLTC 桌游小馆</span></div></div>
        <div className="flex items-center gap-3"><span aria-label="房间码" className="hidden text-sm text-[#c1d1c6] sm:inline">房间 <strong className="ml-1 font-mono text-base tracking-wider text-[#f6ebce]">{room.id}</strong></span>
        <Dialog><DialogTrigger asChild><Button variant="ghost" className="h-11 text-[#f6ebce] hover:bg-white/10 hover:text-white"><Users />房间</Button></DialogTrigger><DialogContent className="camel-font"><DialogHeader><DialogTitle>骆驼大赛 · {room.id}</DialogTitle><DialogDescription>3–6 人 · {connectionState === "live" ? "已连接" : "连接恢复中"} · 分享房间码邀请朋友。</DialogDescription></DialogHeader><div className="rounded-xl bg-[#153b3d] p-3 text-[#f6ebce]">{players}</div>{roomControls}</DialogContent></Dialog>
        <Rules /></div>
      </header>
      {connectionState !== "live" && <p role="status" className="mb-4 rounded-lg bg-[#f5ddb0] p-3 text-sm text-[#59401f]">{connectionState === "connecting" ? "正在连接赛场，请稍候…" : "连接已断开，正在自动重连。恢复后可继续行动。"}</p>}
      {error && <p role="alert" className="mb-4 break-words rounded-lg bg-[#ffe1d2] p-3 text-sm text-[#8b2e1e]">{error}</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="contents min-w-0 gap-4 lg:grid">
          <div className="order-1 flex flex-wrap items-end justify-between gap-2 px-1 lg:order-none"><div><h2 className="mb-1 text-2xl font-bold sm:text-3xl">{!game ? "好戏，马上开跑。" : finished ? "终点已至，金币揭晓。" : `第 ${game.leg} 赛段`}</h2><p className="mb-0 text-sm text-[#c1d1c6]">{!game ? "押对时机，搭上顺风驼。" : finished ? "本段与终局投注已全部结算。" : "赛骆驼朝前，黑白逆驼朝后；叠在上面的领先。"}</p></div>{game && <span className="flex items-center gap-2 text-sm text-[#e6c787]"><Dices className="size-4" />本段已出 {game.rolls.length} / 5 骰</span>}</div>
          <div className="order-2 min-w-0 lg:order-none"><RaceBoard effect={effect} game={game} tileSpaces={tileMode && canAct ? game!.legal.tileSpaces : []} {...(tileMode && canAct ? { onSpace: (space: number) => action({ type: "tile", space, side: tileMode }) } : {})} /></div>
          {game && <>
            <section className="order-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#0f2f31] px-3 py-3" aria-label="当前排名"><span className="mr-1 text-sm text-[#c5d0c1]">实时排名</span>{game.ranking.map((camel, i) => {
              const position = Object.entries(game.stacks).find(([, stack]) => stack.includes(camel));
              return <span key={camel} className="flex items-center gap-1 rounded-md bg-white/8 px-2 py-1 text-sm"><span className="text-[#e7c678]">{i + 1}</span><CamelPiece camel={camel} className="h-7 w-8" />{CAMEL_NAMES[camel]}<span className="text-[#c5d0c1]">{position?.[0]} 格</span></span>;
            })}</section>
            <div className="order-5 flex flex-wrap items-center gap-2 px-1 lg:order-none" aria-label="本段骰子">{game.remainingDice.map(die => <span key={die} className="rounded-md border border-white/25 px-2 py-1 text-sm text-[#d0dacb]">{CAMEL_NAMES[die]} · 未出</span>)}{game.rolls.map(roll => <span key={roll.die} className="rounded-md bg-[#e2bc71] px-2 py-1 text-sm font-bold text-[#213c36]">{CAMEL_NAMES[roll.die]} · {roll.value}</span>)}</div>
          </>}
          <section className="order-6 rounded-xl bg-white/5 p-3 sm:p-4 lg:order-none"><div className="mb-3 flex items-center justify-between"><h2 className="mb-0 text-base font-bold">{game ? "同桌玩家" : "等待朋友入座"}</h2><span className="text-sm text-[#c7d3c6]">{room.members.length} / 6 人</span></div>{players}</section>
          {game && <details className="order-7 rounded-xl bg-white/5 px-4 py-3 lg:order-none"><summary className="cursor-pointer text-sm font-medium">赛场动态 · {game.log.at(-1)}</summary><ol aria-label="赛场动态" className="mt-3 grid max-h-52 gap-2 overflow-y-auto text-sm text-[#d0dacb]">{[...game.log].reverse().map((line, i) => <li key={`${game.revision}:${i}`}>{line}</li>)}</ol></details>}
        </div>
        <aside className="order-3 grid min-w-0 gap-4 rounded-2xl bg-[#f8f5e9] lg:order-none p-4 text-[#263e35] sm:p-5">
          {!game ? <>
            <div><h2 className="mb-3 text-2xl font-bold">谁会笑到最后？</h2><p className="text-base leading-relaxed text-[#626d61]">五只赛骆驼，全桌都能押。它们会叠在一起跑，还可能被逆行骆驼带回起点。</p></div>
            <div className="grid gap-4 border-y border-[#dad8c8] py-4"><p className="mb-0 flex items-center gap-3 text-sm"><TicketIcon />抢赛段票，越早押中赚得越多。</p><p className="mb-0 flex items-center gap-3 text-sm"><Dices className="size-5 shrink-0" />摇骰推动比赛，稳拿 1 金币。</p><p className="mb-0 flex items-center gap-3 text-sm"><Flag className="size-5 shrink-0" />放观众牌，让比赛多一点变数。</p></div>
            <p className="mb-0 text-sm leading-relaxed text-[#626d61]">3–6 人 · 每人 3 金币起步 · 最多金币获胜。终局预测仅自己可见，比赛结束统一揭晓。</p>
            {host ? <Button className="h-14 rounded-xl bg-[#1b5650] text-base font-bold hover:bg-[#24675e]" disabled={busy || room.members.length < CAMEL_UP_PLAYER_LIMITS.min || connectionState !== "live"} onClick={() => void handleStart()}>开始骆驼大赛</Button> : <p role="status" className="text-center font-medium">等待房主开始比赛</p>}
            {room.members.length < CAMEL_UP_PLAYER_LIMITS.min && <p role="status" className="mb-0 text-center text-sm text-[#626d61]">还差 {CAMEL_UP_PLAYER_LIMITS.min - room.members.length} 人，把房间码发给朋友吧。</p>}
          </> : finished ? <>
            <Trophy className="size-10 text-[#9b7021]" /><h2 className="mb-0 text-2xl font-bold">{game.players.filter(p => game.phase.kind === "finished" && game.phase.winnerIds.includes(p.id)).map(p => p.name).join("、")} 获胜</h2>
            <ol aria-label="最终金币排名" className="grid gap-3">{[...game.players].sort((a, b) => b.coins - a.coins).map(p => <li key={p.id} className="flex min-w-0 justify-between gap-3 border-b border-[#ddd8c6] pb-3"><strong className="truncate">{p.name}</strong><span className="shrink-0 font-bold tabular-nums">{p.coins} 金币</span></li>)}</ol>
            <div className="grid gap-2 text-sm"><h3 className="font-bold">终局卡揭晓</h3>{game.revealedFinishBets?.length ? game.revealedFinishBets.map((bet, i) => <p key={i} className="mb-0 break-words">{game.players.find(p => p.id === bet.playerId)?.name} · {bet.kind === "winner" ? "冠军" : "末名"} · {CAMEL_NAMES[bet.camel]}</p>) : <p>本局没有终局投注。</p>}</div>
            {host ? <Button className="h-12" disabled={busy} onClick={() => void onReturnToLobby()}>再来一局</Button> : <p className="text-sm">等待房主再开一局，或从房间菜单离开。</p>}
          </> : <>
            <div aria-live="polite"><div className="mb-2 flex items-center justify-between"><h2 className="mb-0 text-xl font-bold">{game.legal.roll ? "轮到你了" : "等待朋友行动"}</h2><span data-camel-wallet className="flex items-center gap-1 text-base font-bold tabular-nums"><Coins className="size-4 text-[#987123]" />{me?.coins ?? 0}</span></div><p className="mb-0 break-words text-sm text-[#626d61]">{game.legal.roll ? "摇骰、拿票或押注，选一个行动。" : `${activeName} 正在考虑下一步。`}</p></div>
            {game.lastRoll && <p role="status" className="mb-0 rounded-lg bg-[#e9eadc] px-3 py-3 text-sm">刚刚摇出 <strong>{CAMEL_NAMES[game.lastRoll.die]} {game.lastRoll.value}</strong> · {CAMEL_NAMES[game.lastRoll.camel]} 到第 {game.lastRoll.to} 格</p>}
            <RaceActions game={game} busy={busy || connectionState !== "live"} onAction={action} tileMode={tileMode} onTileMode={setTileMode} />
          </>}
          {game && <details open className="border-t border-[#dad8c8] pt-4"><summary className="cursor-pointer text-sm font-bold">我的票与暗投</summary><div className="mt-3 grid gap-2 text-sm text-[#626d61]">{me?.tickets.map((t, i) => <span key={i}>{CAMEL_NAMES[t.camel]}赛段票 · 第一名 +{t.value}</span>)}{Boolean(me?.pyramidTickets) && <span>摇骰票 ×{me!.pyramidTickets} · 每张 +1</span>}{game.ownFinishBets.map((b, i) => <span key={`bet-${i}`}>暗投{b.kind === "winner" ? "冠军" : "末名"} · {CAMEL_NAMES[b.camel]}</span>)}{!me?.tickets.length && !me?.pyramidTickets && !game.ownFinishBets.length && <span>还没有领取票或投出终局卡。</span>}</div></details>}
          {game?.lastLeg && <details className="border-t border-[#dad8c8] pt-4"><summary className="cursor-pointer text-sm font-bold">第 {game.lastLeg.leg} 段结算</summary><ul className="mt-3 grid gap-2 text-sm text-[#626d61]">{game.lastLeg.deltas.map(d => <li key={d.playerId} className="flex justify-between gap-3"><span className="truncate">{game.players.find(p => p.id === d.playerId)?.name}</span><span className="shrink-0">{d.delta >= 0 ? "+" : ""}{d.delta} 金币{d.partnerBonus ? `（合伙 +${d.partnerBonus}）` : ""}</span></li>)}</ul></details>}
        </aside>
      </div>
    </div>
  </main>;
}
function TicketIcon() { return <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4V7Z" /><path d="M15 7v12" strokeDasharray="2 2" /></svg>; }
function Rules() {
  return <Dialog><DialogTrigger asChild><Button variant="ghost" className="h-11 text-[#f6ebce] hover:bg-white/10 hover:text-white"><BookOpen />玩法</Button></DialogTrigger><DialogContent className="camel-font max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>骆驼大赛怎么玩</DialogTitle><DialogDescription>3–6 人。骆驼属于赛场，玩家比拼的是金币。</DialogDescription></DialogHeader><div className="grid gap-3 text-sm leading-relaxed"><p>每回合只做一个行动：领赛段票、放观众牌、摇骰，或暗投整场冠军／末名。六人局还能合伙，本段额外复制对方最好的一张票。</p><p>骆驼会带着头上的整叠一起跑，落在其他骆驼上方；同格上方领先。黑白骆驼逆向走，不参加排名。灰骰遇到只有一只驮着赛骆驼时会移动该只；两只直接相叠时移动上方那只。</p><p>每段出五颗骰子后结算（总共六颗）。赛段票第一名按票面 +5／+3／+2，第二名 +1，其他 −1；摇骰票每张 +1。牌与骰子收回，下一人开始新段。</p><p>欢呼牌沿所移动骆驼朝向多走一格，倒彩牌反向一格并放在堆叠底下。牌主立即 +1。不能放第 1 格、非空格或相邻其他观众牌的位置。</p><p>任意骆驼越过终点立即结束，逆向带过线的赛骆驼排最后。先结算赛段，再结算暗投；正确卡按先后 +8／+5／+3／+2／+1，错误卡 −1。每色终局卡只有一张，冠军和末名共用。</p><p>金币不会低于零，最多金币者共同获胜。网页版公开金币余额、按座位顺序起手，支持 3–6 人。界面与美术独立制作。</p></div></DialogContent></Dialog>;
}
