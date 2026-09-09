import type { ReactNode } from "react";
import type { RoomView } from "@catan/protocol";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { DisbandRoomControl } from "./DisbandRoomControl.js";
import { RulesReference } from "./RulesReference.js";
import { GameMenu } from "./GameMenu.js";

export function TableUtilities({ room, playerId, busy, onDisband, accountControl, soundControl, compact = false, tools, persistentControl }: {
  readonly persistentControl?: ReactNode;
  readonly compact?: boolean;
  readonly tools?: ReactNode;
  readonly accountControl?: ReactNode;
  readonly soundControl?: ReactNode;
  readonly room: RoomView;
  readonly playerId: string;
  readonly busy: boolean;
  readonly onDisband: () => void | Promise<void>;
}) {
  if (room.game === null) return null;

  const rules = <RulesReference
        ruleProfile={room.game.ruleProfile}
        trigger={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="规则速查"
            title="规则速查"
            className="text-[#fff1cf] hover:bg-white/10 hover:text-white"
          >
            <BookOpen />
          </Button>
        }
      />;
  const disband = room.hostPlayerId === playerId ? (
        <DisbandRoomControl
          room={room}
          busy={busy}
          onDisband={onDisband}
          compact
          className="text-[#f3b0a5] hover:bg-[#f3b0a5]/12 hover:text-[#ffd9d2]"
        />
      ) : null;
  return <div className="flex shrink-0 items-center gap-0.5" data-table-utilities="true">
    {compact ? persistentControl : null}
    {compact ? <GameMenu tools={tools}>
      <div><span>账号</span>{accountControl}</div>
      <div><span>游戏音效</span>{soundControl}</div>
      <div><span>规则速查</span>{rules}</div>
      {disband ? <div><span>解散房间</span>{disband}</div> : null}
    </GameMenu> : <>{accountControl}{soundControl}{rules}{disband}</>}
  </div>;
}
