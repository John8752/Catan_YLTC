import type { PokerView } from "@catan/protocol/texas-holdem";
import type { LobbyMemberView } from "@catan/protocol/platform";
import { PLAYER_SWATCH_CLASSES } from "../../lib/player-palette.js";
import { cn } from "../../lib/utils.js";
import type { TablePoint } from "./seat-layout.js";
import { betPosition } from "./seat-layout.js";
import { PlayingCard } from "./PlayingCard.js";
import { Chip } from "./Chip.js";

export function PokerSeat({ player: p, member, game, point, own, remaining }: { player: PokerView["players"][number]; member: LobbyMemberView; game: PokerView; point: TablePoint; own: boolean; remaining: number }) {
  const acting = game.phase.kind === "betting" && game.phase.actorId === p.id;
  const winner = game.result?.pots.some((pot) => pot.winnerIds.includes(p.id));
  const role = game.buttonId === p.id ? "庄" : game.smallBlindId === p.id ? "小盲" : game.bigBlindId === p.id ? "大盲" : "";
  const progress = Math.max(0, Math.min(1, remaining * 1000 / (game.deadline?.durationMs ?? 30000)));
  const bet = betPosition(point);
  return <>
    <div data-poker-seat={p.id} data-player={p.id} data-acting={acting} data-own={own} className={cn("poker-seat absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center", p.folded && !own && "opacity-55")} style={{ left: `${point.x}%`, top: `${point.y}%` }}>
      <p className="mb-1 w-full truncate text-xs font-medium text-[#e4eee6]" title={p.name}>{p.name}{own && " · 你"}</p>
      <div data-poker-avatar={p.id} className={cn("poker-avatar relative flex items-center justify-center rounded-full border-[3px] shadow-[0_3px_8px_#0006]", winner ? "border-[#f3d087]" : acting ? "border-[#71dfbb]" : "border-[#90ac9a]/55", p.eliminated && "grayscale", PLAYER_SWATCH_CLASSES[member.color])}>
        <span className="absolute inset-0 rounded-full bg-black/35" />
        <span className="relative text-base font-semibold text-white drop-shadow-sm sm:text-lg">{p.name.match(/\d+/)?.[0] ?? p.name.slice(0, 2)}</span>
        {acting && <svg className="absolute -inset-[6px] size-[calc(100%+12px)] -rotate-90 overflow-visible" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="none" stroke="#71dfbb" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${188.5 * progress} 188.5`} /></svg>}
        {role && <span data-poker-role className="absolute -bottom-1 -right-2 z-10 min-w-5 rounded-full border border-[#d8c28a] bg-[#e6d9b6] px-1 py-0.5 text-xs font-semibold text-[#26382f]">{role}</span>}
        {winner && <span className="absolute -top-3 rounded-full bg-[#ebc574] px-2 py-0.5 text-xs font-semibold text-[#352a18]">获胜</span>}
        {!own && p.cardCount > 0 && <div className="absolute -right-3 bottom-1 flex -space-x-2" aria-label={`${p.name}的底牌`}>
          {p.hole ? p.hole.map((c) => <PlayingCard key={c} card={c} size="small" />) : <><span className="poker-mini-back -rotate-12" role="img" aria-label="未公开的底牌" /><span className="poker-mini-back rotate-6" role="img" aria-label="未公开的底牌" /></>}
        </div>}
      </div>
      <p data-poker-stack={p.id} className="mt-1 min-w-[54px] max-w-full rounded-full border border-[#8fa68b]/25 bg-[#0c211b]/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-[#f1dfae]">{p.chips.toLocaleString("zh-CN")}</p>
      {(p.folded || p.chips === 0 || p.eliminated) && <span className="absolute left-1/2 top-[43%] z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-[#0b211be8] px-2 py-1 text-xs font-semibold text-[#d8e4d9]">{p.eliminated ? "已淘汰" : p.folded ? "弃牌" : "全下"}</span>}
      {own && p.hole && <div className={cn("poker-own-hand absolute left-1/2 flex -translate-x-1/2 gap-1", p.folded && "opacity-65")} aria-label="你的底牌">{p.hole.map((c) => <PlayingCard key={c} card={c} size="large" highlighted={Boolean(winner && game.result?.shown.find((s) => s.playerId === p.id)?.rank.cards.includes(c))} />)}</div>}
    </div>
    {p.streetBet > 0 && <div data-poker-bet={p.id} className="absolute z-[5] flex -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 text-xs font-medium tabular-nums text-[#f1dfae]" style={{ left: `${bet.x}%`, top: `${bet.y}%` }}><Chip gold={p.chips === 0} /><span>{p.streetBet}</span></div>}
  </>;
}
