import type { AccountMatchRecord } from "@catan/protocol/platform";
import type { DrawGuessSettlementV1 } from "@catan/protocol/draw-guess";

export default function DrawGuessAccountMatchItem({ match }: { readonly match: AccountMatchRecord }) {
    const data = match.data as DrawGuessSettlementV1;
    const you = data.players.find((player) => player.id === match.playerId);
    return <article className="grid min-w-0 gap-2 rounded-xl border p-4" aria-label="已完成对局"><strong>传画猜词 · {data.playerCount} 人 · {data.albumCount} 本画册</strong>
      <p className="text-sm text-muted-foreground">{new Date(match.finishedAt).toLocaleString("zh-CN")}</p><p className="text-sm">你完成了 {you?.submittedPages ?? 0} 页，超时收稿 {you?.timedOutPages ?? 0} 页。</p>
      <p className="break-words text-sm">{data.players.map((player) => player.name).join("、")}</p></article>;
}
