import type { AccountMatchRecord } from "@catan/protocol/platform";
import type { CatanSettlementV1 } from "@catan/protocol/catan";
import { CatanResultPanel } from "./GameResult.js";

export default function CatanAccountMatchItem({ match }: { readonly match: AccountMatchRecord }) {
  const data = match.data as CatanSettlementV1;
  return <article className="grid min-w-0 gap-2" aria-label="已完成对局">
    <p className="text-sm text-muted-foreground">
      {new Date(match.finishedAt).toLocaleString("zh-CN")} · {data.players.length} 人 · {data.winnerId === match.playerId ? "你赢得了本局" : "已完成"}
    </p>
    <CatanResultPanel result={data} />
  </article>;
}
