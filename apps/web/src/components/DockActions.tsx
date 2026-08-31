import { describeAction, type GameView } from "@catan/protocol";
import { ChevronDown, Dices, Hammer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { Badge } from "./ui/badge.js";
import { Button } from "./ui/button.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible.js";

export function DockActions({ game, compact, buildMode, selectedRobberHexId, children }: {
  readonly game: GameView;
  readonly compact: boolean;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly selectedRobberHexId: string | null;
  readonly children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const prompt = describeAction(game.interaction);
  const turnNumber = game.phase.kind === "turn" ? game.phase.turnNumber : null;
  useEffect(() => setExpanded(false), [game.id, game.you.id, game.interaction.kind, turnNumber, compact]);
  useEffect(() => { if (buildMode !== null) setExpanded(false); }, [buildMode]);
  const mustResolve = game.interaction.kind === "turn-roll" || game.interaction.kind === "discard" ||
    (game.interaction.kind === "robber" && game.interaction.targets.some((target) => target.hexId === selectedRobberHexId && target.victimIds.length > 1));
  const open = !compact || mustResolve || expanded;
  const title = compact && buildMode !== null ? `请在地图选择${{ road: "道路位置", settlement: "定居点位置", city: "要升级的村庄" }[buildMode]}`
    : prompt?.title ?? (compact ? game.interaction.instruction : "本回合操作");

  return <Collapsible open={open} onOpenChange={setExpanded} asChild>
    <section className="col-span-2 min-w-0 rounded-xl border border-[#6d5434]/15 bg-white/40 px-2 py-1 md:col-span-1 md:col-start-2 md:row-span-3 md:row-start-1 lg:py-1 xl:col-start-3 xl:row-span-2" aria-label="本回合操作">
      <div className={cn("flex items-center justify-between gap-1 phone-landscape:flex-wrap", compact ? "min-h-8" : "mb-1")}>
        <span data-action-title="true" title={title} className={cn("flex min-w-0 items-center gap-1 text-xs font-black text-[#5d665f] phone-landscape:basis-full lg:text-sm", prompt?.tone === "required" && "text-[#8c3f3a]")}>
          <Hammer className="hidden size-3.5 shrink-0 lg:block" aria-hidden="true" /><span className="truncate">{title}</span>
        </span>
        {game.lastRoll === null ? null : <Badge variant="secondary" className="shrink-0 gap-1 px-1.5" aria-label={`骰子：${game.lastRoll[0]} + ${game.lastRoll[1]}`}>
          <Dices className="size-3.5" aria-hidden="true" />{game.lastRoll[0]} + {game.lastRoll[1]}
        </Badge>}
        {compact && !mustResolve ? <CollapsibleTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0 gap-0.5 px-1.5 text-xs" aria-label={open ? "收起本回合操作" : "展开本回合操作"}>
            {open ? "收起" : "操作"}<ChevronDown className={cn("size-3.5", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger> : null}
      </div>
      <CollapsibleContent className={cn("max-h-[28dvh] overflow-y-auto lg:max-h-[min(28dvh,13rem)]", compact && "pt-1 pb-0.5")} data-dock-action-details="true">
        {children}
      </CollapsibleContent>
    </section>
  </Collapsible>;
}
