import type { AccountMatchRecord } from "@catan/protocol/platform";
import type { PokerSettlementV1 } from "@catan/protocol/texas-holdem";
export default function PokerAccountMatchItem({ match }: { match: AccountMatchRecord }) {
  const data = match.data as PokerSettlementV1, you = data.standings.find((p) => p.playerId === match.playerId);
  return <article className="grid min-w-0 gap-2 rounded-xl border p-4" aria-label="已完成对局"><strong>德州扑克 · {data.mode === "tournament" ? "锦标赛" : "固定手数"} · {data.completedHands} 手</strong>
    <p className="text-sm text-muted-foreground">{new Date(match.finishedAt).toLocaleString("zh-CN")}</p><p className="text-sm">第 {you?.rank ?? "—"} 名 · 剩余 {you?.chips ?? 0} 筹码 · 初始 {data.startingChips}</p>
    <p className="break-words text-sm">{data.standings.map((p) => `${p.name} ${p.chips}`).join("、")}</p></article>;
}
