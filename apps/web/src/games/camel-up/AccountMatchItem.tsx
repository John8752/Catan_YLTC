import type { AccountMatchRecord } from "@catan/protocol/platform";
import type { CamelSettlementV1 } from "@catan/protocol/camel-up";
export default function CamelAccountMatchItem({ match }: { match: AccountMatchRecord }) {
  const data = match.data as CamelSettlementV1, you = data.players.find(p => p.id === match.playerId);
  return <article className="grid gap-2 rounded-xl border p-4" aria-label="已完成对局"><strong>骆驼大赛 · {data.players.length} 人 · {data.legs} 赛段</strong><p className="mb-0 text-sm text-muted-foreground">{new Date(match.finishedAt).toLocaleString("zh-CN")}</p><p className="mb-0 text-sm">你获得 {you?.coins ?? 0} 金币{data.winnerIds.includes(match.playerId) ? "，赢得了比赛。" : "。"}</p><p className="mb-0 break-words text-sm">{data.players.map(p => `${p.name} ${p.coins}`).join(" · ")}</p></article>;
}
