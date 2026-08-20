import { analyzeMap, type GameMap, type MapResourceAnalysis, type ResourceType } from "@catan/game-core";
import { Gauge, MapPinned, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/lib/utils.js";

const RESOURCE_UI: Readonly<Record<ResourceType, { label: string; mark: string; color: string }>> = {
  brick: { label: "砖", mark: "▧", color: "bg-[#a9503e]" },
  lumber: { label: "木", mark: "♠", color: "bg-[#39714a]" },
  wool: { label: "羊", mark: "●", color: "bg-[#73935e]" },
  grain: { label: "麦", mark: "≋", color: "bg-[#c49735]" },
  ore: { label: "矿", mark: "◆", color: "bg-[#66747a]" },
};

export function MapAnalysisPanel({ map }: { readonly map: GameMap }) {
  const analysis = analyzeMap(map);
  const maximumPips = Math.max(...analysis.resources.map((resource) => resource.productionPips));

  return (
    <section
      className="mx-2 rounded-2xl border border-white/20 bg-[#102f30]/48 p-3 text-[#fff9e8] shadow-lg backdrop-blur-sm"
      aria-label="地图产能分析"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-[#efbd79]" aria-hidden="true" />
          <strong className="text-sm">地图公平度 {analysis.score}</strong>
          <Badge className="border-white/15 bg-white/12 text-[#fff4d6]">{gradeLabel(analysis.grade)}</Badge>
        </div>
        <p className="m-0 text-[11px] text-white/62">按骰点产能计算，不含建筑成本与交易价值</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        {analysis.resources.map((resource) => (
          <ResourceProduction key={resource.resource} resource={resource} maximumPips={maximumPips} />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/72">
        <span className="inline-flex items-center gap-1">
          <TrendingDown className="size-3.5 text-[#efbd79]" />全图最稀缺：{RESOURCE_UI[analysis.scarcestResource].label}
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="size-3.5 text-[#a9d69c]" />全图最高产：{RESOURCE_UI[analysis.mostAbundantResource].label}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPinned className="size-3.5 text-[#b9dce1]" />强力交叉点 {analysis.strongVertexCount} 个
        </span>
      </div>
    </section>
  );
}

function ResourceProduction({
  resource,
  maximumPips,
}: {
  readonly resource: MapResourceAnalysis;
  readonly maximumPips: number;
}) {
  const ui = RESOURCE_UI[resource.resource];
  return (
    <div className="rounded-xl border border-white/10 bg-white/8 px-2.5 py-2" data-resource-analysis={resource.resource}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black">
          <span className={cn("grid size-5 place-items-center rounded-md text-[11px] text-white", ui.color)} aria-hidden="true">{ui.mark}</span>
          {ui.label}
        </span>
        <span className={cn(
          "text-[10px] font-black",
          resource.strength === "strong" ? "text-[#b7e4a9]" : resource.strength === "weak" ? "text-[#ffd08a]" : "text-white/65",
        )}>{strengthLabel(resource.strength)}</span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <strong className="font-serif text-base leading-none">{resource.productionPips}</strong>
        <span className="text-[10px] text-white/52">产能点 · {resource.tileCount} 地块</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/20" aria-hidden="true">
        <span className={cn("block h-full rounded-full", ui.color)} style={{ width: `${(resource.productionPips / maximumPips) * 100}%` }} />
      </div>
    </div>
  );
}

function gradeLabel(grade: "excellent" | "balanced" | "variable"): string {
  return { excellent: "非常均衡", balanced: "均衡", variable: "有起伏" }[grade];
}

function strengthLabel(strength: "strong" | "balanced" | "weak"): string {
  return { strong: "偏旺", balanced: "正常", weak: "偏弱" }[strength];
}
