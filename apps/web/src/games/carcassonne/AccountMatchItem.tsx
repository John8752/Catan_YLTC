import type { AccountMatchRecord } from "@catan/protocol/platform";
import type { CarcassonneSettlementV1 } from "@catan/protocol/carcassonne";
export default function CarcassonneMatchItem({match}:{readonly match:AccountMatchRecord}) {
  const data=match.data as CarcassonneSettlementV1,own=data.players.find((p)=>p.id===match.playerId);
  return <article className="grid min-w-0 gap-2 rounded-xl border p-4" aria-label="已完成对局"><strong>卡卡颂 · {data.playerCount} 人 · {data.tilesPlaced} 块板块</strong><p className="text-sm text-muted-foreground">{new Date(match.finishedAt).toLocaleString('zh-CN')}</p><p className="text-sm">你获得 {own?.score??0} 分，第 {own?.rank??'—'} 名。</p><p className="break-words text-sm">{[...data.players].sort((a,b)=>b.score-a.score).map((p)=>`${p.name} ${p.score} 分`).join(' · ')}</p></article>;
}
