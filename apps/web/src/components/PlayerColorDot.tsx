import type { PlayerColor } from "@catan/game-core";
import { cn } from "@/lib/utils.js";

const PLAYER_COLORS = {
  terracotta: "bg-[#c85d42]",
  ocean: "bg-[#3886a5]",
  pine: "bg-[#3f8057]",
  wheat: "bg-[#d2a534]",
  plum: "bg-[#81577d]",
  charcoal: "bg-[#48504f]",
} as const satisfies Record<PlayerColor, string>;

export function PlayerColorDot({ color, className }: { readonly color: PlayerColor; readonly className?: string }) {
  return <span className={cn("shrink-0 rounded-full ring-1 ring-white/65", PLAYER_COLORS[color], className)} aria-hidden="true" />;
}
