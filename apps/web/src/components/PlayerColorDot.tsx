import type { PlayerColor } from "@catan/game-core";
import { PLAYER_SWATCH_CLASSES } from "@/lib/player-palette.js";
import { cn } from "@/lib/utils.js";

export function PlayerColorDot({ color, className }: { readonly color: PlayerColor; readonly className?: string }) {
  return <span className={cn("shrink-0 rounded-full ring-1 ring-white/65", PLAYER_SWATCH_CLASSES[color], className)} aria-hidden="true" />;
}
