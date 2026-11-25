import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { GAME_CATALOG,DEFAULT_GAME_ID,getGameDefinition,isGameType,unregisteredGame,type GameType, type AccountMatchRecord } from "@catan/protocol/platform";
import { getMatchHistory } from "../auth-api.js";
import { Button } from "./ui/button.js";

const PokerMatchItem = lazy(() => import("../games/texas-holdem/AccountMatchItem.js"));
const CatanMatchItem = lazy(() => import("../games/catan/AccountMatchItem.js"));
const DrawGuessMatchItem = lazy(() => import("../games/draw-guess/AccountMatchItem.js"));
const CarcassonneMatchItem = lazy(() => import("../games/carcassonne/AccountMatchItem.js"));

const CamelMatchItem = lazy(() => import("../games/camel-up/AccountMatchItem.js"));

export function AccountHistory() {
  const [gameId, setGameId] = useState<GameType>(DEFAULT_GAME_ID);
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
  return <section className="grid min-w-0 gap-3" aria-label={getGameDefinition(gameId).historyLabel}>
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
  const gameId=match.gameId;
  if(!isGameType(gameId)||match.dataVersion!==getGameDefinition(gameId).settlementVersion)return <p>此对局的结算版本暂不支持显示。</p>;
  function result(id:GameType){
    switch(id){
      case "catan":return <CatanMatchItem match={match}/>;
      case "draw-guess":return <DrawGuessMatchItem match={match}/>;
      case "camel-up":return <CamelMatchItem match={match}/>;
      case "carcassonne":return <CarcassonneMatchItem match={match}/>;
      case "texas-holdem":return <PokerMatchItem match={match}/>;
      default:return unregisteredGame(id);
    }
  }
  return <Suspense fallback={<p role="status">正在读取对局…</p>}>{result(gameId)}</Suspense>;
}
