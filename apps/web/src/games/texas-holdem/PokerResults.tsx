import { HAND_NAMES, type PokerView } from "@catan/protocol/texas-holdem";
import { PlayingCard } from "./PlayingCard.js";
export function PokerResults({ game }: { game: PokerView }) {
  const result = game.result;
  if (!result) return null;
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "玩家";
  return <section className="grid gap-3 text-[#f7ecd6]" aria-label="本手结算">
    <h2 className="text-center text-lg font-bold">{result.reason === "fold" ? "其他玩家弃牌，直接收池" : "摊牌结算"}</h2>
    <ul className="space-y-1 text-center text-sm">{result.pots.map((pot, i) => <li key={i} className="break-words">{i === 0 ? "主池" : `边池 ${i}`} {pot.amount} · {pot.shares.map((s) => `${name(s.playerId)} +${s.amount}`).join("、")}</li>)}</ul>
    {result.refunds.length > 0 && <p className="text-center text-xs text-[#d7e2d8]">{result.refunds.map((r) => `${name(r.playerId)} 退回未跟注筹码 ${r.amount}`).join("；")}</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{result.shown.map((p) => <div key={p.playerId} className="flex items-center gap-3 border-t border-[#a7c0ad]/30 pt-3"><div className="flex gap-1">{p.hole.map((c) => <PlayingCard key={c} card={c} />)}</div><div className="min-w-0"><p className="truncate text-sm font-bold" title={name(p.playerId)}>{name(p.playerId)}</p><p className="text-sm text-[#eed095]">{HAND_NAMES[p.rank.category]}</p><p className="mt-1 text-xs text-[#d7e2d8]">最佳五张</p><div className="mt-1 flex flex-wrap gap-1">{p.rank.cards.map((c) => <PlayingCard key={c} card={c} size="small" />)}</div></div></div>)}</div>
  </section>;
}
