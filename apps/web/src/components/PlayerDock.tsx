import type { GameCommand, GameView } from "@catan/protocol";
import { Dices, Hammer, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Card } from "@/components/ui/card.js";
import { cn } from "@/lib/utils.js";
import { GameControls } from "./GameControls.js";

export interface PlayerDockProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId: string | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
}

const RESOURCE_PRESENTATION = {
  brick: { label: "砖", mark: "▧", className: "from-[#b95842] to-[#914331]" },
  lumber: { label: "木", mark: "♠", className: "from-[#47865b] to-[#2e6643]" },
  wool: { label: "羊", mark: "⌁", className: "from-[#8dab70] to-[#6f9158]" },
  grain: { label: "麦", mark: "≋", className: "from-[#d6aa42] to-[#b88627]" },
  ore: { label: "矿", mark: "◆", className: "from-[#78878c] to-[#59686e]" },
} as const;

export function PlayerDock({
  game,
  busy,
  onCommand,
  buildMode,
  selectedRobberHexId,
  onBuildModeChange,
}: PlayerDockProps) {
  return (
    <Card className="player-dock gap-0 overflow-visible border-white/20 bg-[#f3e6c8]/96 p-3 shadow-2xl backdrop-blur-sm lg:col-start-1 lg:row-start-3">
      <div className="grid items-stretch gap-3 xl:grid-cols-[auto_minmax(270px,.75fr)_minmax(430px,1.25fr)]">
        <div className="flex min-w-28 items-center gap-2 rounded-xl border border-[#6d5434]/15 bg-white/35 px-3 py-2">
          <span className="grid size-10 place-items-center rounded-full bg-[#1f5651] text-[#fff8df]"><UserRound className="size-5" /></span>
          <div>
            <span className="block text-[10px] font-black tracking-[.12em] text-[#9d513d] uppercase">你的席位</span>
            <strong className="text-sm text-[#243d39]">{game.you.name}</strong>
          </div>
        </div>

        <section className="grid grid-cols-5 gap-2" aria-label="你的资源">
          {Object.entries(game.you.resources).map(([resource, count]) => {
            const presentation = RESOURCE_PRESENTATION[resource as keyof typeof RESOURCE_PRESENTATION];
            return (
              <div
                className={cn("relative min-w-0 overflow-hidden rounded-xl bg-gradient-to-b px-2 py-2 text-white shadow-md", presentation.className)}
                key={resource}
                data-resource-target={`${game.you.id}:${resource}`}
              >
                <span className="block text-xl leading-none opacity-70" aria-hidden="true">{presentation.mark}</span>
                <span className="mt-1 block text-[10px] font-bold opacity-85">{presentation.label}</span>
                <strong className="absolute top-1.5 right-2 text-xl leading-none">{count}</strong>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl border border-[#6d5434]/15 bg-white/40 px-3 py-2" aria-label="本回合操作">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black tracking-[.12em] text-[#5d665f] uppercase"><Hammer className="size-3.5" />本回合操作</span>
            {game.lastRoll === null ? null : (
              <Badge
                variant="secondary"
                className="gap-1"
                aria-label={`骰子：${game.lastRoll[0]} + ${game.lastRoll[1]}`}
              >
                <Dices className="size-3.5" aria-hidden="true" />{game.lastRoll[0]} + {game.lastRoll[1]}
              </Badge>
            )}
          </div>
          <GameControls
            game={game}
            busy={busy}
            onCommand={onCommand}
            buildMode={buildMode}
            selectedRobberHexId={selectedRobberHexId}
            onBuildModeChange={onBuildModeChange}
          />
        </section>
      </div>
    </Card>
  );
}
