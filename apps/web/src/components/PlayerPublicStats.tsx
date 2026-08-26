import type { PublicPlayerView } from "@catan/protocol";
import { cn } from "@/lib/utils.js";

interface PlayerPublicStatsProps {
  readonly player: PublicPlayerView;
  readonly tone: "dark" | "light";
  readonly density?: "compact" | "comfortable";
  readonly className?: string;
}

export function PlayerPublicStats({ player, tone, density = "compact", className }: PlayerPublicStatsProps) {
  const metrics = [
    { shortLabel: "路", displayLabel: "道路", label: "剩余道路", value: player.remainingPieces.roads },
    { shortLabel: "村", displayLabel: "村庄", label: "剩余村庄", value: player.remainingPieces.settlements },
    { shortLabel: "城", displayLabel: "城市", label: "剩余城市", value: player.remainingPieces.cities },
    { shortLabel: "骑", displayLabel: "骑士", label: "已出骑士", value: player.playedKnights },
    { shortLabel: "长", displayLabel: "最长", label: "最长道路长度", value: player.longestRoadLength },
  ] as const;

  return (
    <div
      className={cn("grid grid-cols-5 gap-0.5", className)}
      aria-label={`${player.name}的棋子与战绩`}
    >
      {metrics.map((metric) => (
        <span
          key={metric.shortLabel}
          className={cn(
            "flex min-w-0 items-baseline justify-center gap-px rounded leading-tight font-bold",
            density === "compact" ? "px-0.5 py-px text-[8px] lg:text-[10px]" : "px-1 py-1 text-[9px] lg:text-[11px]",
            tone === "dark" ? "bg-white/8 text-[#d7e2da]" : "bg-[#6d5434]/8 text-[#5e655e]",
          )}
          title={`${metric.label} ${metric.value}`}
          aria-label={`${metric.label} ${metric.value}`}
        >
          <span aria-hidden="true">{density === "compact" ? metric.shortLabel : metric.displayLabel}</span>
          <b className={tone === "dark" ? "text-[#fff4c9]" : "text-[#264640]"}>{metric.value}</b>
        </span>
      ))}
    </div>
  );
}
