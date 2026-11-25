import type { Camel } from "@catan/game-core/camel-up";
import { useLayoutEffect, useRef, useState } from "react";
import type { CamelGameView } from "@catan/protocol/camel-up";
import { CAMEL_NAMES } from "@catan/protocol/camel-up";
import { CamelShape } from "./CamelPiece.js";
import "./playfield.css";
import { cn } from "../../lib/utils.js";
const desktopSpaces = [[155, 463], [262, 490], [374, 500], [486, 490], [597, 465], [690, 414], [735, 326], [715, 232], [638, 168], [536, 138], [427, 133], [318, 146], [218, 181], [134, 245], [91, 332], [99, 411]] as const;
export function FlatRaceBoard({ game, tileSpaces = [], onSpace, fit = false }: { fit?: boolean; game: CamelGameView | null; tileSpaces?: number[]; onSpace?: (space: number) => void }) {
  const arena = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(800);
  useLayoutEffect(() => {
    const element = arena.current; if (!fit || !element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry && entry.contentRect.width > 0) setHeight(Math.max(590, 840 * entry.contentRect.height / entry.contentRect.width)); });
    observer.observe(element); return () => observer.disconnect();
  }, [fit]);
  const viewHeight = fit ? height : 590;
  const centerY = fit ? (viewHeight + 90) / 2 : 306;
  const spaces: readonly (readonly [number, number])[] = fit ? Array.from({ length: 16 }, (_, i) => {
    const angle = 2.25 - i * Math.PI / 8;
    return [420 + 330 * Math.cos(angle), centerY + (viewHeight / 2 - 105) * Math.sin(angle)] as const;
  }) : desktopSpaces;
  const stacks: Record<number, Camel[]> = game?.stacks ?? { 1: ["blue", "green"], 2: ["red"], 3: ["yellow", "purple"], 15: ["white"], 16: ["black"] };
  return <div ref={arena} className={cn("camel-playfield relative isolate w-full overflow-hidden rounded-2xl bg-[#d59d50]", fit && "h-full")} aria-label="骆驼赛道">
    <img src="/games/camel-up/desert-arena.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
    <svg viewBox={`0 0 840 ${viewHeight}`} className={cn("relative block w-full", fit && "h-full")} role="group" aria-label="16 格环形赛道，骆驼在同一格时上层领先">
      <path d={`M ${spaces.map(p => p.join(",")).join(" L ")} Z`} fill="none" stroke="#714521" strokeOpacity=".5" strokeWidth="97" strokeLinejoin="round" />
      <path d={`M ${spaces.map(p => p.join(",")).join(" L ")} Z`} fill="none" stroke="#f9df9e" strokeWidth="88" strokeLinejoin="round" />
      {spaces.map(([x, y], i) => {
        const space = i + 1, tile = game?.tiles.find(t => t.space === space), selectable = tileSpaces.includes(space);
        return <g key={space} transform={`translate(${x} ${y})`}>
          <rect x="-43" y="-40" width="86" height="82" rx="16" fill={selectable ? "#e0eee0" : "#f8dfa7"} stroke={selectable ? "#1e6556" : "#bf9451"} strokeWidth={selectable ? 4 : 1.5} />
          <text textAnchor="middle" y="35" fill="#79552d" fontSize="28" fontWeight="700">{space}</text>
          {tile && <><rect x="-32" y="-31" width="64" height="49" rx="9" fill={tile.side === "cheer" ? "#256252" : "#b44834"} /><text y="2" textAnchor="middle" fill="#fff6dd" fontSize="28" fontWeight="800">{tile.side === "cheer" ? "+1" : "−1"}</text></>}
        </g>;
      })}
      <text x={fit ? spaces[0]![0] + 20 : 164} y={fit ? spaces[0]![1] - 58 : 406} fill="#233d35" fontSize="21" fontWeight="800">起点 / 终点</text>
      <g transform={`translate(421 ${centerY})`}><rect x="-132" y="-37" width="264" height="75" rx="14" fill="#163e3e" /><text textAnchor="middle" y="-1" fill="#fff0c9" fontSize="27" fontWeight="800">{game ? `第 ${game.leg} 赛段` : "沙漠赛场"}</text><text textAnchor="middle" y="25" fill="#e1c788" fontSize="16">{game ? `已出骰 ${game.rolls.length} / 5` : "一叠骆驼，无限变数"}</text></g>
      {Object.entries(stacks).flatMap(([raw, stack]) => {
        const position = Number(raw), point = spaces[Math.max(1, Math.min(16, position)) - 1]!;
        return stack.map((camel, layer) => <g key={camel} className="camel-piece" style={{ transform: `translate(${point[0]}px, ${point[1] - 5 - layer * 18}px)` }}>
          <title>{CAMEL_NAMES[camel]} · 第 {position} 格 · 从下数第 {layer + 1} 层</title><CamelShape camel={camel} />
        </g>);
      })}
      {onSpace && tileSpaces.map(space => {
        const [x, y] = spaces[space - 1]!;
        return <foreignObject key={`target-${space}`} x={x - 44} y={y - 43} width="88" height="86"><button type="button" aria-label={`放在第 ${space} 格`} onClick={() => onSpace(space)} className="h-full w-full rounded-xl border-2 border-dashed border-[#1d6256] bg-emerald-100/25 transition-colors hover:bg-emerald-100/70 focus-visible:bg-emerald-100/70 focus-visible:outline-4 focus-visible:outline-[#1d6256]" /></foreignObject>;
      })}
    </svg>
  </div>;
}
