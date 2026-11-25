import { ActionMedallion } from "./ActionMedallion.js";
import { useState, type ReactNode } from "react";
import { Coins, Flag, Handshake, Ticket, Trophy, WalletCards } from "lucide-react";
import { CAMEL_NAMES, type CamelGameView } from "@catan/protocol/camel-up";
import { DICE, type CamelAction } from "@catan/game-core/camel-up";
import { Button } from "../../components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog.js";
import { cn } from "../../lib/utils.js";
import { RaceActions, type RaceActionMode } from "./RaceActions.js";
import { RaceBoard } from "./RaceBoard.js";
import { CamelPiece } from "./CamelPiece.js";
interface Props {
  effect: CamelGameView["effect"]; game: CamelGameView; playerId: string; roomMenu: ReactNode; rules: ReactNode; busy: boolean; error: string | null;
  connectionState: "connecting" | "live" | "offline"; onAction: (action: CamelAction) => void;
  tileMode: "cheer" | "boo" | null; onTileMode: (mode: "cheer" | "boo" | null) => void;
}
/** The Catan surface pattern: compact seats, fitted board, always-reachable bottom dock. */
export function MobileRaceTable({ effect, game, playerId, roomMenu, rules, busy, error, connectionState, onAction, tileMode, onTileMode }: Props) {
  const [mode, setMode] = useState<RaceActionMode | null>(null);
  const activeId = game.phase.kind === "racing" ? game.phase.activePlayerId : null;
  const activeName = game.players.find(p => p.id === activeId)?.name;
  const me = game.players.find(p => p.id === playerId)!;
  const available = game.legal.roll && connectionState === "live" && !busy;
  const actions = [{ id: "ticket", label: "赛段票", Icon: Ticket }, { id: "tile", label: "观众牌", Icon: Flag }, { id: "finish", label: "终局卡", Icon: Trophy }, ...(game.players.length >= 6 ? [{ id: "partner", label: "合伙", Icon: Handshake }] : [])] as const;
  function submit(action: CamelAction) { if (!available) return; setMode(null); onAction(action); }
  return <main aria-label="骆驼大赛手机桌面" className="camel-font grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden bg-[#153b3d] p-[max(.35rem,env(safe-area-inset-top),env(safe-area-inset-left),env(safe-area-inset-right))] pb-[max(.35rem,env(safe-area-inset-bottom))] text-[#f8edce] selection:bg-[#e3b557] selection:text-[#173a39]">
    <header className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 px-1"><div><h1 className="mb-0 text-lg font-bold">骆驼大赛<span className="ml-2 text-sm font-normal text-[#e2c689]">第 {game.leg} 段</span></h1><p className="mb-0 text-sm text-[#c5d3c5]">{connectionState === "live" ? `本段已出 ${game.rolls.length} / 5 骰` : connectionState === "connecting" ? "正在连接赛场…" : "离线 · 正在自动重连…"}</p></div><div className="flex shrink-0 items-center">{roomMenu}{rules}</div></div>
      <ol className="grid grid-flow-col auto-cols-fr gap-1" aria-label="座位顺序">{game.players.map(p => <li key={p.id} aria-label={`${p.name}，${p.coins} 金币${p.id === activeId ? "，当前行动" : ""}`} className={cn("min-w-0 rounded-lg border border-white/15 bg-white/5 px-1 py-1.5 text-center", p.id === activeId && "border-[#e7bb67] bg-[#31594c]")}>
        <span title={p.name} className="block truncate text-sm font-semibold">{p.id === playerId ? "你" : Array.from(p.name).slice(0, 3).join("")}</span><span className="block text-sm tabular-nums text-[#e5cd92]">{p.coins} 金币</span>
      </li>)}</ol>
      <div className="grid grid-cols-6 gap-1" aria-label="本段骰子">{DICE.map(die => { const roll = game.rolls.find(r => r.die === die); return <span key={die} className={cn("rounded px-1 py-1 text-center text-sm", roll ? "bg-[#e2bc71] font-bold text-[#213c36]" : "bg-white/5 text-[#d0dacb]")}>{CAMEL_NAMES[die].slice(0, 1)} · {roll?.value ?? "未"}</span>; })}</div>
    </header>
    <section aria-label="赛场" className="flex min-h-0 min-w-0 flex-col gap-1.5">
      <div className="min-h-0 flex-1"><RaceBoard effect={effect} fit game={game} tileSpaces={tileMode && available ? game.legal.tileSpaces : []} {...(tileMode && available ? { onSpace: (space: number) => submit({ type: "tile", space, side: tileMode }) } : {})} /></div>
      <ol aria-label="当前排名" className="grid shrink-0 grid-cols-5 gap-1">{game.ranking.map((camel, index) => <li key={camel} className="flex min-w-0 items-center justify-center gap-0.5 rounded-md bg-[#0c2f31] px-0.5 py-1"><span className="text-sm tabular-nums text-[#e5cd92]">{index + 1}</span><CamelPiece camel={camel} className="h-7 w-7 shrink-0" /><span className="text-sm">{CAMEL_NAMES[camel].slice(0, 1)}</span></li>)}</ol>
    </section>
    <footer aria-label="底部行动区" className="grid shrink-0 gap-2 rounded-xl bg-[#f8f5e9] p-3 text-[#263e35]">
      <div className="flex min-w-0 items-center justify-between gap-2"><div className="min-w-0" aria-live="polite"><h2 className="mb-0 truncate text-base font-bold">{game.legal.roll ? "轮到你了" : "等待朋友行动"}</h2><p className="mb-0 truncate text-sm text-[#56675b]">{game.lastRoll ? `${CAMEL_NAMES[game.lastRoll.die]} ${game.lastRoll.value} · ${CAMEL_NAMES[game.lastRoll.camel]}到第 ${game.lastRoll.to} 格` : game.legal.roll ? "每回合选择一个行动" : `${activeName} 正在行动`}</p></div>
        <Dialog><DialogTrigger asChild><Button aria-label="我的金币与票" data-camel-wallet variant="ghost" className="h-11 shrink-0 gap-1 px-2"><Coins className="text-[#947023]" /><span className={cn("text-base font-bold tabular-nums", effect?.legEnded && "camel-coin-feedback")}>{me.coins}</span><WalletCards /></Button></DialogTrigger><DialogContent className="camel-font max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>我的票与暗投</DialogTitle><DialogDescription>赛段票公开，终局卡在比赛结束前只有自己可见。</DialogDescription></DialogHeader><div className="grid gap-3 text-sm">{me.tickets.map((t, i) => <p key={i}>{CAMEL_NAMES[t.camel]}赛段票 · 第一名 +{t.value}</p>)}<p>摇骰票 ×{me.pyramidTickets} · 每张 +1</p>{game.ownFinishBets.map((bet, i) => <p key={i}>暗投{bet.kind === "winner" ? "冠军" : "末名"} · {CAMEL_NAMES[bet.camel]}</p>)}{me.partnerId && <p>本段合伙人：{game.players.find(p => p.id === me.partnerId)?.name}</p>}<h3 className="font-bold">赛场动态</h3><ol className="grid gap-2">{game.log.slice(-8).reverse().map((line, i) => <li key={i}>{line}</li>)}</ol>{game.lastLeg && <><h3 className="font-bold">第 {game.lastLeg.leg} 段结算</h3>{game.lastLeg.deltas.map(d => <p key={d.playerId}>{game.players.find(p => p.id === d.playerId)?.name} · {d.delta >= 0 ? "+" : ""}{d.delta} 金币{d.partnerBonus ? `（合伙 +${d.partnerBonus}）` : ""}</p>)}</>}</div></DialogContent></Dialog>
      </div>
      {error && <p role="alert" className="mb-0 max-h-16 overflow-y-auto rounded bg-[#ffe2d3] px-2 py-1 text-sm text-[#8b2e1e]">{error}</p>}
      <Button disabled={!available} className="h-12 rounded-lg bg-linear-to-b from-[#efcc82] to-[#dca84e] text-base font-bold shadow-[inset_0_1px_0_#fff1c7,inset_0_-3px_0_#b38432,0_3px_6px_#99803c20] active:translate-y-0.5 text-[#233c32] hover:bg-[#efc672]" onClick={() => submit({ type: "roll" })}>摇动金字塔<span className="ml-2 text-sm font-normal">结算时 +1 金币</span></Button>
      <div className={cn("grid gap-2", game.players.length >= 6 ? "grid-cols-4" : "grid-cols-3")}>{actions.map(({ id, label, Icon }) => <Button key={id} variant="outline" className="h-12 gap-1 rounded-xl border-[#c6d1bb] bg-[#fffdf4] px-1 text-sm shadow-[0_3px_0_#d7d7c4] transition-[transform,box-shadow] active:translate-y-0.5 active:shadow-none" onClick={() => { setMode(id as RaceActionMode); onTileMode(id === "tile" ? "cheer" : null); }}><ActionMedallion Icon={Icon} tone={id === "tile" ? "jade" : id === "finish" ? "clay" : "gold"} />{label}</Button>)}</div>
    </footer>
    <Dialog open={mode !== null} onOpenChange={open => !open && setMode(null)}><DialogContent className="camel-font max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>选择回合行动</DialogTitle><DialogDescription>{game.legal.roll ? "完成一次行动后，轮到下一位玩家。" : `当前由 ${activeName} 行动，你可以先查看选项。`}</DialogDescription></DialogHeader>{mode && <RaceActions key={mode} initialMode={mode} hideRoll game={game} busy={busy || connectionState !== "live"} onAction={submit} tileMode={tileMode} onTileMode={onTileMode} />}</DialogContent></Dialog>
  </main>;
}
