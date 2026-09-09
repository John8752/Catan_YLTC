import { useEffect, useRef, useState } from "react";
import { CATAN_GAME_ID, GAME_CATALOG, type GameType, type AccountMatchRecord, type CatanSettlementV1 } from "@catan/protocol";
import type { DrawGuessSettlementV1 } from "@catan/protocol/draw-guess";
import { getMatchHistory } from "../auth-api.js";
import { CatanResultPanel } from "./GameResult.js";
import { Button } from "./ui/button.js";

export function AccountHistory() {
  const [gameId, setGameId] = useState<GameType>(CATAN_GAME_ID);
  const currentGame = useRef(gameId); currentGame.current = gameId;
  const [matches, setMatches] = useState<readonly AccountMatchRecord[]>([]);
  const [offset, setOffset] = useState<number | null>(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setMatches([]); setOffset(0); setBusy(true); setError(null);
    void getMatchHistory(gameId).then((result) => {
      if (active) { setMatches(result.matches); setOffset(result.nextOffset); }
    }).catch(() => active && setError("对局记录加载失败，请关闭后重试"))
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [gameId]);
  async function more() {
    if (offset === null || busy) return;
    setBusy(true); setError(null);
    try {
      const result = await getMatchHistory(gameId, offset);
      if (currentGame.current !== gameId) return;
      setMatches((previous) => [...previous, ...result.matches.filter((next) => !previous.some((old) => old.matchId === next.matchId && old.gameId === next.gameId))]);
      setOffset(result.nextOffset);
    } catch { if (currentGame.current === gameId) setError("加载失败，请重试"); }
    finally { if (currentGame.current === gameId) setBusy(false); }
  }
  return <section className="grid min-w-0 gap-3" aria-label={gameId === "catan" ? "卡坦岛对局记录" : "传画猜词对局记录"}>
    <label className="flex items-center gap-3 text-sm font-medium">记录游戏<select className="min-h-10 min-w-0 rounded-lg border px-3" value={gameId} onChange={(e) => setGameId(e.target.value as GameType)}>{GAME_CATALOG.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
    <p className="text-sm text-muted-foreground">仅保存正常结束的对局结算。中途解散不记录；传画猜词不长期保存画作或词语。</p>
    {error && <p role="alert">{error}</p>}
    {!busy && matches.length === 0 && !error && <p>还没有已完成的对局。</p>}
    {matches.map((match) => <MatchItem key={`${match.gameId}:${match.matchId}`} match={match} />)}
    {busy && <p role="status">正在读取对局…</p>}
    {offset !== null && !busy && matches.length > 0 && <Button variant="outline" onClick={() => void more()}>更多对局</Button>}
  </section>;
}
function MatchItem({ match }: { readonly match: AccountMatchRecord }) {
  if (match.gameId === "draw-guess" && match.dataVersion === 1) {
    const data = match.data as DrawGuessSettlementV1;
    const you = data.players.find((player) => player.id === match.playerId);
    return <article className="grid min-w-0 gap-2 rounded-xl border p-4" aria-label="已完成对局"><strong>传画猜词 · {data.playerCount} 人 · {data.albumCount} 本画册</strong>
      <p className="text-sm text-muted-foreground">{new Date(match.finishedAt).toLocaleString("zh-CN")}</p><p className="text-sm">你完成了 {you?.submittedPages ?? 0} 页，超时收稿 {you?.timedOutPages ?? 0} 页。</p>
      <p className="break-words text-sm">{data.players.map((player) => player.name).join("、")}</p></article>;
  }
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
