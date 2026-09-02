import { PLAYER_COLORS, type PlayerColor } from "@catan/game-core";
import type { LobbyMemberView } from "@catan/protocol";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.js";
import { PLAYER_COLOR_LABELS } from "@/lib/player-palette.js";
import { cn } from "@/lib/utils.js";
import { PlayerSettlementIcon } from "./PlayerSettlementIcon.js";

export function PlayerColorPicker({
  currentColor,
  members,
  busy,
  onChange,
}: {
  readonly currentColor: PlayerColor;
  readonly members: readonly LobbyMemberView[];
  readonly busy: boolean;
  readonly onChange: (color: PlayerColor) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-1.5 px-1.5 text-[#435a54] hover:bg-white/65"
          aria-label={`选择玩家颜色，当前${PLAYER_COLOR_LABELS[currentColor]}`}
          disabled={busy}
        >
          <PlayerSettlementIcon color={currentColor} className="size-7" />
          <span className="hidden text-[11px] font-bold sm:inline">换颜色</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(20rem,calc(100vw-1rem))] border-[#695237]/20 bg-[#f8ecd2] p-2 text-[#263d39]"
        aria-label="选择玩家颜色"
      >
        <p className="mb-2 px-1 text-xs font-black tracking-[.1em] text-[#5d665f] uppercase">选择你的村庄颜色</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PLAYER_COLORS.map((color) => {
            const owner = members.find((member) => member.color === color);
            const selected = color === currentColor;
            const occupied = owner !== undefined && !selected;
            return (
              <Button
                key={color}
                type="button"
                variant="ghost"
                className={cn(
                  "relative h-17 min-w-0 flex-col gap-0 rounded-lg border border-[#695237]/12 bg-white/35 px-1 py-1 text-[10px] text-[#3d514c] hover:bg-white/70 hover:text-[#3d514c] focus-visible:text-[#3d514c]",
                  selected && "border-[#37685d]/45 bg-[#dbe8df] text-[#294d45] ring-1 ring-[#37685d]/25 hover:bg-[#d2e3d8] hover:text-[#294d45]",
                  occupied && "bg-[#d9d2c3]/40 grayscale-[.45]",
                )}
                aria-label={`${PLAYER_COLOR_LABELS[color]}${selected ? "，当前颜色" : occupied ? `，已被${owner.name}选择` : "，可选择"}`}
                aria-pressed={selected}
                disabled={busy || occupied}
                data-player-color-option={color}
                data-color-occupied={occupied || undefined}
                onClick={() => {
                  if (!selected) onChange(color);
                  setOpen(false);
                }}
              >
                <PlayerSettlementIcon color={color} className="size-8" />
                <span className="max-w-full truncate">{PLAYER_COLOR_LABELS[color]}</span>
                {selected ? <Check className="absolute top-1 right-1 size-3 text-[#37685d]" aria-hidden="true" /> : null}
                {occupied ? <span className="absolute top-1 right-1 rounded bg-[#6d6558]/75 px-1 text-[8px] text-white">占用</span> : null}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
