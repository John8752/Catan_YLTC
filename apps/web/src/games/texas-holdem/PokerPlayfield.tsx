import { useId, type RefObject } from "react";
import type { PokerRoomView, PokerView } from "@catan/protocol/texas-holdem";
import { PlayingCard } from "./PlayingCard.js";
import { PokerSeat } from "./PokerSeat.js";
import { Chip } from "./Chip.js";
import type { TablePoint } from "./seat-layout.js";
import "./poker-playfield.css";
const streets = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌" };
export function PokerPlayfield({ room, game, viewerId, stageRef, points, remaining, skin, onResults }: { room: PokerRoomView; game: PokerView; viewerId: string; stageRef: RefObject<HTMLDivElement | null>; points: ReadonlyMap<string, TablePoint>; remaining: number; skin: "green" | "midnight"; onResults: () => void }) {
  const uid = useId().replaceAll(":", ""), pot = game.result ? game.result.pots.reduce((n, p) => n + p.amount, 0) : game.pot;
  const winners = game.result ? [...new Set(game.result.pots.flatMap((p) => p.winnerIds))] : [];
  return <div ref={stageRef} className="poker-playfield poker-felt relative mx-auto min-h-0 w-full max-w-5xl flex-1" data-skin={skin} role="region" aria-label="公共牌桌">
    <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 400 680" preserveAspectRatio="none" aria-hidden="true">
      <defs><radialGradient id={`${uid}-felt`} cx="48%" cy="40%" r="75%"><stop stopColor="var(--felt-center)" /><stop offset="1" stopColor="var(--felt-edge)" /></radialGradient><linearGradient id={`${uid}-rail`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#37463a" /><stop offset=".45" stopColor="#111e19" /><stop offset="1" stopColor="#26362b" /></linearGradient></defs>
      <rect x="24" y="11" width="352" height="655" rx="170" fill={`url(#${uid}-rail)`} stroke="#050f0b" strokeWidth="10" />
      <rect x="34" y="23" width="332" height="631" rx="160" fill={`url(#${uid}-felt)`} stroke="var(--rim)" strokeWidth="3" />
      <rect x="39" y="29" width="322" height="619" rx="155" fill="none" stroke="var(--rim-light)" strokeWidth=".7" opacity=".55" />
      <rect x="62" y="70" width="276" height="517" rx="135" fill="none" stroke="#c2dfc2" strokeWidth=".5" opacity=".12" />
    </svg>
    <div className="absolute left-1/2 top-[27%] z-[5] flex -translate-x-1/2 flex-col items-center gap-1" data-poker-pot="true" aria-label="底池"><span className="text-[10px] text-[#c3d9c7]">{game.result ? "本手底池" : "总底池"}</span><span className="flex items-center gap-1.5 rounded-full border border-[#a3c5a2]/15 bg-[#0b3027]/65 px-4 py-1 text-sm font-semibold tabular-nums text-[#f0e2b7]"><Chip />{pot}</span></div>
    <div className="absolute left-1/2 top-[44%] z-[5] flex -translate-x-1/2 -translate-y-1/2 gap-1" aria-label="公共牌">{Array.from({ length: 5 }, (_, i) => <span key={i} data-board-index={i} className="inline-flex">{game.board[i] ? <PlayingCard card={game.board[i]!} size="table" /> : <span className="poker-community-slot rounded-[3px] border border-[#a8c8aa]/20 bg-[#003a2d]/20" aria-label="待发公共牌" />}</span>)}</div>
    <div className="pointer-events-none absolute left-1/2 top-[53%] w-[56%] -translate-x-1/2 text-center text-[10px] text-[#b1cdb9]">{game.phase.kind === "betting" ? streets[game.phase.street] : game.phase.kind === "finished" ? "本局结束" : "本手结束"}</div>
    {game.result && <section aria-label="本手结算" className="absolute left-1/2 top-[56%] z-20 flex w-[58%] -translate-x-1/2 flex-col items-center gap-1 text-center">
      <p className="w-full truncate text-xs font-bold text-[#f3d38c]">{winners.map((id) => game.players.find((p) => p.id === id)?.name).join("、")} 收池</p>
      <button className="min-h-8 rounded-full border border-[#c5b780]/45 bg-[#0b2c22]/90 px-3 text-[10px] text-[#f1e3bd] outline-none hover:bg-[#304d37] focus-visible:ring-2 focus-visible:ring-[#e5c680]" onClick={onResults}>{game.phase.kind === "finished" ? "查看最终排名" : "查看摊牌与底池"}</button>
    </section>}
    {game.players.map((p) => <PokerSeat key={p.id} player={p} member={room.members.find((m) => m.id === p.id)!} game={game} point={points.get(p.id)!} own={p.id === viewerId} remaining={remaining} />)}
    <div className="absolute left-[48%] top-[21%] -rotate-12" aria-hidden="true" data-poker-deck="true"><span className="poker-mini-back absolute translate-x-1 translate-y-0.5" /><span className="poker-mini-back absolute" /></div>
  </div>;
}
