import type { RoomView } from "@catan/protocol";
import { DoorClosed } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { cn } from "@/lib/utils.js";

export function DisbandRoomControl({ room, busy, onDisband, compact = false, className }: {
  readonly room: RoomView;
  readonly busy: boolean;
  readonly onDisband: () => void | Promise<void>;
  readonly compact?: boolean;
  readonly className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="解散房间"
            title="解散房间"
            className={cn("text-[#8d4632] hover:bg-[#a94f3a]/12 hover:text-[#8d4632]", className)}
            disabled={busy}
          >
            <DoorClosed />
          </Button>
        ) : (
          <Button
            variant="ghost"
            className={cn("w-full text-[#8d4632] hover:bg-[#a94f3a]/12 hover:text-[#8d4632]", className)}
            disabled={busy}
          >
            <DoorClosed className="size-4" />解散房间
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="border-[#f7e6bf]/30 bg-[#f8ecd2] text-[#263d39] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>确认解散房间？</DialogTitle>
          <DialogDescription className="leading-relaxed text-[#66716b]">
            {room.game === null
              ? `房间会立即关闭，其余 ${room.members.length - 1} 人会被退回首页。`
              : `进行中的这局会立即结束且无法恢复，桌上 ${room.members.length} 人全部退回首页。`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">再想想</Button>
          </DialogClose>
          <Button
            type="button"
            className="bg-[#a94f3a] text-white hover:bg-[#93432f]"
            disabled={busy}
            onClick={onDisband}
          >
            {busy ? "正在解散…" : "解散房间"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
