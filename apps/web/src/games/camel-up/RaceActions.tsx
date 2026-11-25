import { ActionMedallion } from "./ActionMedallion.js";
import { useState } from "react";
import { Dices, Flag, Handshake, Ticket, Trophy } from "lucide-react";
import type { BetKind, CamelAction } from "@catan/game-core/camel-up";
import { CAMEL_NAMES, type CamelGameView } from "@catan/protocol/camel-up";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs.js";
import { Button } from "../../components/ui/button.js";
import { cn } from "../../lib/utils.js";
import { CamelPiece } from "./CamelPiece.js";
import { CAMEL_COLORS } from "./palette.js";
export type RaceActionMode = "ticket" | "tile" | "finish" | "partner";
export function RaceActions({ game, busy, onAction, tileMode, onTileMode, initialMode = "ticket", hideRoll = false }: { initialMode?: RaceActionMode; hideRoll?: boolean; game: CamelGameView; busy: boolean; onAction: (action: CamelAction) => void; tileMode: "cheer" | "boo" | null; onTileMode: (side: "cheer" | "boo" | null) => void }) {
  const [mode, setMode] = useState<RaceActionMode>(initialMode);
  const [betKind, setBetKind] = useState<BetKind>("winner");
  const legal = game.legal, active = legal.roll;
  const modes = [{ id: "ticket", label: "赛段票", Icon: Ticket }, { id: "tile", label: "观众牌", Icon: Flag }, { id: "finish", label: "终局卡", Icon: Trophy }, ...(game.players.length >= 6 ? [{ id: "partner", label: "合伙", Icon: Handshake }] : [])] as const;
  return <section aria-label="回合行动" className="grid gap-4">
    {!hideRoll && <><Button className="h-14 w-full rounded-xl bg-[#e3b557] text-base font-bold text-[#253d36] hover:bg-[#efc672]" disabled={busy || !active} onClick={() => onAction({ type: "roll" })}><ActionMedallion Icon={Dices} className="size-9" />摇动金字塔<span className="ml-auto text-sm font-medium">结算时 +1 金币</span></Button>
    <div className="flex items-center gap-3 text-sm text-[#6c776c]"><span className="h-px flex-1 bg-[#dcd8c7]" />或选择一个行动<span className="h-px flex-1 bg-[#dcd8c7]" /></div></>}
    <Tabs value={mode} onValueChange={value => { setMode(value as RaceActionMode); onTileMode(value === "tile" ? "cheer" : null); }}>
    <TabsList className={cn("grid h-auto! w-full gap-1 bg-[#ecebdf] p-1", game.players.length >= 6 ? "grid-cols-4" : "grid-cols-3")} aria-label="行动类型">{modes.map(({ id, label, Icon }) => <TabsTrigger key={id} value={id} className="min-h-11 gap-1.5 px-2 text-sm data-[state=active]:bg-white"><ActionMedallion Icon={Icon} tone={id === "tile" ? "jade" : id === "finish" ? "clay" : "gold"} />{label}</TabsTrigger>)}</TabsList>
    <TabsContent value="ticket"><div><p className="mb-3 text-sm leading-relaxed text-[#626d61]">押本赛段领先的骆驼。第一名按票面收钱，第二名 +1，其余 −1。</p><div className="grid grid-cols-5 gap-1.5 lg:grid-cols-1 lg:gap-2">{game.ticketSupply.map(t => <button key={t.camel} type="button" aria-label={`领取${CAMEL_NAMES[t.camel]}赛段票`} disabled={busy || !legal.tickets.some(a => a.camel === t.camel)} onClick={() => onAction({ type: "ticket", camel: t.camel })} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-lg lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 border border-[#d9d7c7] bg-white px-1 text-center lg:px-3 lg:text-left transition-colors hover:bg-[#f3f0df] focus-visible:outline-2 focus-visible:outline-[#24675c]">
      <CamelPiece camel={t.camel} /><strong className="text-sm">{CAMEL_NAMES[t.camel]}</strong><span className="ml-auto hidden text-sm text-[#697367] lg:inline">余 {t.remaining} 张</span><span className="w-full text-center text-lg lg:w-12 lg:text-right lg:text-xl font-bold tabular-nums" style={{ color: t.camel === "yellow" ? "#806219" : CAMEL_COLORS[t.camel] }}>{t.value === null ? "已领完" : `+${t.value}`}</span>
    </button>)}</div></div></TabsContent>
    <TabsContent value="tile"><div className="grid gap-3"><p className="text-sm leading-relaxed text-[#626d61]">落上你的牌，立得 1 金币。选择朝向，再点赛道上的绿色空格。</p><div className="grid grid-cols-2 gap-2">{(["cheer", "boo"] as const).map(side => <Button key={side} disabled={busy || !active} variant="outline" aria-pressed={tileMode === side} className={cn("h-12 bg-white", tileMode === side && "border-[#216152] bg-[#e0ece3] text-[#164e40]")} onClick={() => onTileMode(side)}>{side === "cheer" ? "欢呼 · 前进 1 格" : "倒彩 · 后退 1 格"}</Button>)}</div><p className="text-sm text-[#626d61]">不能放第 1 格、骆驼所在格或紧邻其他观众牌。</p><div className="grid grid-cols-5 gap-2 lg:hidden" aria-label="按格号放观众牌">{legal.tileSpaces.map(space => <Button key={space} variant="outline" className="min-h-12 bg-white" disabled={busy || !tileMode} onClick={() => tileMode && onAction({ type: "tile", space, side: tileMode })}>第 {space} 格</Button>)}</div></div></TabsContent>
    <TabsContent value="finish"><div className="grid gap-3"><p className="text-sm leading-relaxed text-[#626d61]">秘密预测整场比赛。越早押中，收益越高。每种颜色只能投一次。</p><div className="grid grid-cols-2 gap-2">{(["winner", "loser"] as const).map(kind => <Button key={kind} variant="outline" aria-pressed={betKind === kind} className={cn("h-11 bg-white", betKind === kind && "bg-[#e0ece3]")} onClick={() => setBetKind(kind)}>{kind === "winner" ? "总冠军" : "总末名"} · {game.finishBetCounts[kind]} 张</Button>)}</div><div className="flex flex-wrap gap-2">{legal.finishCards.map(camel => <Button key={camel} variant="outline" className="h-auto min-h-20 flex-1 flex-col bg-white px-2" disabled={busy} onClick={() => onAction({ type: "finish-bet", camel, kind: betKind })}><CamelPiece camel={camel} />{CAMEL_NAMES[camel]}</Button>)}</div>{active && !legal.finishCards.length && <p role="status">你的五张终局卡已全部投出。</p>}<p className="text-sm text-[#626d61]">正确依次 +8 / +5 / +3 / +2 / +1；错误 −1。投出后不能更改。</p></div></TabsContent>
    <TabsContent value="partner"><div className="grid gap-3"><p className="text-sm leading-relaxed text-[#626d61]">六人局专属。本段结算时，双方额外获得对方收益最高的一张票的奖励。</p>{legal.partners.map(id => <Button key={id} variant="outline" disabled={busy} onClick={() => onAction({ type: "partner", playerId: id })}>与 {game.players.find(p => p.id === id)?.name} 合伙</Button>)}{!legal.partners.length && <p className="text-sm">当前没有可合伙的玩家。</p>}</div></TabsContent>
    </Tabs>
    {!active && <p className="text-sm text-[#697367]">等待你的回合，届时可选择任意一种行动。</p>}
  </section>;
}
