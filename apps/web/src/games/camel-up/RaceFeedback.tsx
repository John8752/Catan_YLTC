import { Coins, Dices, Flag, Handshake, LockKeyhole, Ticket, Trophy } from "lucide-react";
import { CAMEL_NAMES, type CamelGameView } from "@catan/protocol/camel-up";
import { cn } from "../../lib/utils.js";
export function RaceFeedback({ game, effect }: { game: CamelGameView; effect: CamelGameView["effect"] }) {
  if (!effect) return null;
  const actor = game.players.find(p => p.id === effect.playerId)?.name;
  const Icon = effect.finished ? Trophy : effect.legEnded ? Coins : ({ roll: Dices, ticket: Ticket, tile: Flag, "finish-bet": LockKeyhole, partner: Handshake })[effect.type];
  const title = effect.finished ? "冲过终点！" : effect.legEnded ? `第 ${game.lastLeg?.leg} 赛段结算` : effect.type === "roll" ? `${game.lastRoll ? CAMEL_NAMES[game.lastRoll.die] : "骰子"} · ${effect.value} 点` : effect.type === "ticket" ? `收下${effect.camel && CAMEL_NAMES[effect.camel]}赛段票` : effect.type === "tile" ? `第 ${effect.space} 格，观众就位` : effect.type === "finish-bet" ? `总${effect.betKind === "winner" ? "冠军" : "末名"}，已秘密押注` : "本赛段合伙成立";
  return <div key={`${game.id}:${effect.revision}`} data-camel-feedback={effect.type} role="status" className={cn("camel-action-feedback pointer-events-none absolute left-1/2 top-16 z-10 flex w-max max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#173f3c] px-4 py-3 text-[#fff0c9] shadow-[0_10px_28px_#11373240]", effect.legEnded && "bg-[#704b22]")}>
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edc46b] text-[#304536] shadow-[inset_0_2px_0_#fff1bd,inset_0_-3px_0_#b48935]"><Icon className="size-6" strokeWidth={1.8} /></span><span className="min-w-0"><strong className="block text-base">{title}</strong><span className="block truncate text-sm text-[#dfd3ae]">{effect.finished ? "赛段与终局卡已全部结算" : effect.legEnded ? "金币已结算，下一段继续争先" : `${actor}${effect.type === "roll" ? ` · ${effect.camel && CAMEL_NAMES[effect.camel]}到第 ${effect.space} 格` : ""}`}</span></span>
  </div>;
}
