import type { CatanSettlementV1, GameView, PlayerGameSummaryView } from "@catan/protocol";
import { BarChart3, ChevronDown, Crown, Dices, Route, ShieldCheck, Trophy } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/button.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { PLAYER_SWATCH_CLASSES } from "@/lib/player-palette.js";
import { cn } from "@/lib/utils.js";
import { ResourceIcon } from "./ResourceIcon.js";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
const CONFETTI_COLORS = ["#f0c75e", "#d96b4e", "#75a889", "#72a9c0", "#f5e1a4"] as const;

export function GameResult({ game }: { readonly game: GameView }) {
  const [collapsed, setCollapsed] = useState(false);
  if (game.phase.kind !== "finished" || game.summary === null) return null;

  if (collapsed) {
    return (
      <Button className="game-result-reopen" type="button" onClick={() => setCollapsed(false)}>
        <Trophy />查看赛后战报
      </Button>
    );
  }

  return (
    <section className="game-result-overlay" aria-label="赛后战报">
      <div className="game-result-confetti" aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <span key={index} style={confettiStyle(index)} />
        ))}
      </div>
      <CatanResultPanel result={{ players: game.players, winnerId: game.phase.winnerId,
        victoryPointsToWin: game.victoryPointsToWin, summary: game.summary }} onViewBoard={() => setCollapsed(true)} />
    </section>
  );
}

/** One presentation for live results and durable account history; needs no live game state. */
type ResultData = Pick<CatanSettlementV1, "players" | "winnerId" | "victoryPointsToWin" | "summary">;
export function CatanResultPanel({ result: game, onViewBoard }: {
  readonly result: ResultData;
  readonly onViewBoard?: () => void;
}) {
  const winner = game.players.find((player) => player.id === game.winnerId);
  const winnerSummary = game.summary.players.find((player) => player.playerId === game.winnerId);
  if (!winner || !winnerSummary) return null;
  return (
    <section aria-label="赛后结算" className={cn("game-result-panel text-[#fff8df]", !onViewBoard && "!max-h-none min-w-0 shadow-none")}>
      <header className="game-result-header">
        <div className="winner-medallion"><Crown aria-hidden="true" /></div>
        <div className={cn("min-w-0 flex-1 break-words", !onViewBoard && "!pr-0")}>
          <p className="eyebrow">对局结束 · {winnerTitle(winnerSummary, game)}</p>
          <h2>{winner.name} 赢得群岛</h2>
          <p>{winnerNarrative(winner.name, winnerSummary, game)}</p>
        </div>
        {onViewBoard && <Button type="button" variant="secondary" size="sm" onClick={onViewBoard}><ChevronDown />查看棋盘</Button>}
      </header>

      <div className="game-result-meta">
        <span><Dices />共掷骰 {game.summary.totalRolls} 次</span>
        <span><BarChart3 />目标 {game.victoryPointsToWin} 分</span>
        <span><Trophy />{scoreBreakdown(winnerSummary)}</span>
      </div>

      <Tabs defaultValue="overview" className="game-result-tabs [--foreground:#fff8df] [--ring:#f0c56b] [&_[data-slot=tabs-trigger]]:text-white/85 [&_[data-slot=tabs-trigger]:hover]:text-white [&_[data-slot=tabs-trigger][data-state=active]]:text-white [&_[data-slot=tabs-trigger]]:after:bg-[#f0c56b]">
        <div className="overflow-x-auto pb-1">
          <TabsList variant="line" className="min-w-max text-[#fff8df]">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="dice">骰子统计</TabsTrigger>
            <TabsTrigger value="cards">资源卡统计</TabsTrigger>
            <TabsTrigger value="activity">活动统计</TabsTrigger>
            <TabsTrigger value="resources">资源统计</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview"><Overview game={game} /></TabsContent>
        <TabsContent value="dice"><DiceSummary game={game} /></TabsContent>
        <TabsContent value="cards"><ResourceCardSummary game={game} /></TabsContent>
        <TabsContent value="activity"><ActivitySummary game={game} /></TabsContent>
        <TabsContent value="resources"><ResourceSummary game={game} /></TabsContent>
      </Tabs>
    </section>
  );
}

function Overview({ game }: { readonly game: ResultData }) {
  // Ranked by what actually won the game, not by what was on the board.
  const ranked = [...requireSummary(game).players].sort((first, second) => second.score.total - first.score.total);
  return (
    <div className="result-ranking">
      {ranked.map((summary, index) => {
        const player = requirePlayer(game, summary.playerId);
        const winner = player.id === game.winnerId;
        return (
          <article className={cn("result-player-row", winner && "is-winner")} key={player.id}>
            <span className="result-rank">{index + 1}</span>
            <span className={cn("result-player-color", PLAYER_SWATCH_CLASSES[player.color])} />
            <strong className="min-w-0 break-words">{player.name}</strong>
            <span className="result-score">{summary.score.total}<small>总分</small></span>
            <span className="result-score-sources">
              {summary.score.settlements > 0 ? `${summary.score.settlements} 村庄` : ""}
              {summary.score.cities > 0 ? `${summary.score.cities} 城市` : ""}
              {summary.score.victoryPointCards > 0 ? `${summary.score.victoryPointCards} 分卡` : ""}
              {summary.score.longestRoad ? <Route aria-label="最长道路" /> : null}
              {summary.score.largestArmy ? <ShieldCheck aria-label="最大骑士力" /> : null}
            </span>
          </article>
        );
      })}
    </div>
  );
}

function DiceSummary({ game }: { readonly game: ResultData }) {
  const dice = requireSummary(game).diceTotals;
  const maximum = Math.max(1, ...dice.map((entry) => entry.count));
  return (
    <div className="dice-summary" aria-label="骰子点数出现次数">
      {dice.map((entry) => (
        <div className={cn("dice-bar-column", entry.total === 7 && "is-seven")} key={entry.total}>
          <strong>{entry.count}</strong>
          <span style={{ height: `${Math.max(8, (entry.count / maximum) * 100)}%` }} />
          <small>{entry.total}</small>
        </div>
      ))}
    </div>
  );
}

function ResourceCardSummary({ game }: { readonly game: ResultData }) {
  return (
    <ResultTable headings={["玩家", "开局", "骰产", "交易入", "海贸入", "偷取", "被偷", "建造/发展", "交易出", "弃牌", "终局"]}>
      {requireSummary(game).players.map((summary) => {
        const cards = summary.resourceCards;
        return (
          <tr key={summary.playerId}>
            <PlayerCell game={game} playerId={summary.playerId} />
            <td>{cards.starting}</td><td>{cards.produced}</td><td>{cards.tradeReceived}</td><td>{cards.maritimeReceived}</td>
            <td>{cards.stolen}</td><td>{cards.robbed}</td><td>{cards.spent}</td><td>{cards.tradedAway}</td><td>{cards.discarded}</td><td>{cards.finalHand}</td>
          </tr>
        );
      })}
    </ResultTable>
  );
}

function ActivitySummary({ game }: { readonly game: ResultData }) {
  return (
    <ResultTable headings={["玩家", "掷骰", "道路", "村庄", "城市", "发展购入", "发展使用", "玩家交易", "海上贸易", "强盗"]}>
      {requireSummary(game).players.map((summary) => {
        const activity = summary.activity;
        return (
          <tr key={summary.playerId}>
            <PlayerCell game={game} playerId={summary.playerId} />
            <td>{activity.rolls}</td><td>{activity.roadsBuilt}</td><td>{activity.settlementsBuilt}</td><td>{activity.citiesBuilt}</td>
            <td>{activity.developmentCardsBought}</td><td>{activity.developmentCardsPlayed}</td><td>{activity.playerTrades}</td>
            <td>{activity.maritimeTrades}</td><td>{activity.robberMoves}</td>
          </tr>
        );
      })}
    </ResultTable>
  );
}

function ResourceSummary({ game }: { readonly game: ResultData }) {
  return (
    <ResultTable headings={["玩家", ...RESOURCES.map(resourceLabel), "骰产合计"]}>
      {requireSummary(game).players.map((summary) => (
        <tr key={summary.playerId}>
          <PlayerCell game={game} playerId={summary.playerId} />
          {RESOURCES.map((resource) => (
            <td key={resource}>
              <span className="result-resource-value"><svg viewBox="-22 -22 44 44"><ResourceIcon kind={resource} /></svg>{summary.productionByResource[resource]}</span>
            </td>
          ))}
          <td>{summary.resourceCards.produced}</td>
        </tr>
      ))}
    </ResultTable>
  );
}

function ResultTable({ headings, children }: { readonly headings: readonly string[]; readonly children: ReactNode }) {
  return (
    <div className="result-table-scroll">
      <table className="result-table">
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function PlayerCell({ game, playerId }: { readonly game: ResultData; readonly playerId: string }) {
  const player = requirePlayer(game, playerId);
  return <th scope="row"><span className={cn("result-player-color", PLAYER_SWATCH_CLASSES[player.color])} />{player.name}</th>;
}

function winnerTitle(summary: PlayerGameSummaryView, game: ResultData): string {
  if (summary.score.longestRoad && summary.score.largestArmy) return "海陆双冠";
  if (summary.score.cities >= 3) return "城邦筑造者";
  if (summary.score.longestRoad) return "道路织网者";
  if (summary.score.largestArmy) return "骑士统帅";
  const bestProduction = Math.max(...requireSummary(game).players.map((player) => player.resourceCards.produced));
  if (summary.resourceCards.produced === bestProduction && bestProduction > 0) return "丰饶经营家";
  return "稳健拓荒者";
}

function winnerNarrative(name: string, summary: PlayerGameSummaryView, game: ResultData): string {
  const achievements = [
    summary.score.settlements > 0 ? `${summary.score.settlements} 座村庄` : null,
    summary.score.cities > 0 ? `${summary.score.cities} 座城市` : null,
    summary.score.longestRoad ? "最长道路" : null,
    summary.score.largestArmy ? "最大骑士力" : null,
  ].filter((item): item is string => item !== null);
  const hiddenFinish = summary.visibleVictoryPoints < game.victoryPointsToWin ? "，并以暗藏的发展成果完成致胜一击" : "";
  return `${name} 凭借${achievements.join("、") || "稳健的岛屿经营"}累积 ${summary.visibleVictoryPoints} 明分${hiddenFinish}。全场生产 ${summary.resourceCards.produced} 张资源，铺设 ${summary.activity.roadsBuilt} 条道路。`;
}

function scoreBreakdown(summary: PlayerGameSummaryView): string {
  const points = [
    `${summary.score.settlements} 村庄`,
    `${summary.score.cities} 城市`,
    summary.score.victoryPointCards > 0 ? `${summary.score.victoryPointCards} 分卡` : null,
    summary.score.longestRoad ? "最长道路" : null,
    summary.score.largestArmy ? "最大骑士力" : null,
  ].filter((item): item is string => item !== null);
  return `${summary.score.total} 分 · ${points.join(" · ")}`;
}

function requireSummary(game: ResultData) {
  if (game.summary === null) throw new Error("Finished game summary is missing");
  return game.summary;
}

function requirePlayer(game: ResultData, playerId: string) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) throw new Error(`Missing result player ${playerId}`);
  return player;
}

function resourceLabel(resource: typeof RESOURCES[number]): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}

function confettiStyle(index: number): CSSProperties {
  return {
    left: `${4 + ((index * 17) % 92)}%`,
    backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length] ?? "#f0c75e",
    animationDelay: `${(index % 7) * 90}ms`,
    animationDuration: `${2_400 + (index % 5) * 180}ms`,
    rotate: `${(index * 37) % 180}deg`,
  };
}
