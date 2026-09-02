import type { PlayerColor } from "@catan/game-core";
import { cn } from "@/lib/utils.js";

export function SettlementShape() {
  return (
    <>
      <path className="piece-building-shadow" d="M-11 9V-5L0-14L11-5V9Z" transform="translate(0 2)" />
      <path className="piece-building-body" d="M-11 9V-5L0-14L11-5V9Z" />
      <path className="piece-building-shine" d="M-8-4L0-11L8-4" />
      <rect className="piece-building-door" x="-2.5" y="2" width="5" height="7" rx="1" />
    </>
  );
}

export function PlayerSettlementIcon({ color, className, label }: {
  readonly color: PlayerColor;
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <svg
      className={cn("size-8 shrink-0 overflow-visible", className)}
      viewBox="-17 -19 34 34"
      role={label === undefined ? undefined : "img"}
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
    >
      <g className={`piece-color-${color}`} transform="scale(1.16)">
        <SettlementShape />
      </g>
    </svg>
  );
}
