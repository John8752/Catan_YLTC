import { useEffect, useState } from "react";
import { CATAN_GAME_ID, type AccountMatchRecord, type CatanSettlementV1 } from "@catan/protocol";
import { getMatchHistory } from "../auth-api.js";
import { CatanResultPanel } from "./GameResult.js";
import { Button } from "./ui/button.js";

export function AccountHistory() {
  const [matches, setMatches] = useState<readonly AccountMatchRecord[]>([]);
  const [offset, setOffset] = useState<number | null>(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getMatchHistory(CATAN_GAME_ID).then((result) => {
      if (active) { setMatches(result.matches); setOffset(result.nextOffset); }
    }).catch(() => active && setError("对局记录加载失败，请关闭后重试"))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, []);
  async function more() {
    if (offset === null || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await getMatchHistory(CATAN_GAME_ID, offset);
      setMatches((previous) => [...previous, ...result.matches.filter((next) => !previous.some((old) => old.matchId === next.matchId && old.gameId === next.gameId))]);
      setOffset(result.nextOffset);
    } catch { setError("加载失败，请重试"); }
    finally { setBusy(false); }
  }
  return <section className="grid min-w-0 gap-3" aria-label="卡坦岛对局记录">
    <p className="text-sm text-muted-foreground">卡坦岛 · 仅保存正常结束的对局结算。中途解散的对局不会记录。</p>
    {error && <p role="alert">{error}</p>}
    {!busy && matches.length === 0 && !error && <p>还没有已完成的对局。</p>}
    {matches.map((match) => <MatchItem key={`${match.gameId}:${match.matchId}`} match={match} />)}
    {busy && <p role="status">正在读取对局…</p>}
    {offset !== null && !busy && matches.length > 0 && <Button variant="outline" onClick={() => void more()}>更多对局</Button>}
  </section>;
}
function MatchItem({ match }: { readonly match: AccountMatchRecord }) {
  if (match.gameId !== CATAN_GAME_ID || match.dataVersion !== 1) {
    return <p>此对局的结算版本暂不支持显示。</p>;
  }
  const data = match.data as CatanSettlementV1;
  return <article className="grid min-w-0 gap-2" aria-label="已完成对局">
    <p className="text-sm text-muted-foreground">
      {new Date(match.finishedAt).toLocaleString("zh-CN")} · {data.players.length} 人 · {data.winnerId === match.playerId ? "你赢得了本局" : "已完成"}
    </p>
    <CatanResultPanel result={data} />
  </article>;
}
