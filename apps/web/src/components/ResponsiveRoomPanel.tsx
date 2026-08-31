import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog.js";
import { useMediaQuery } from "@/hooks/use-media-query.js";
import { RoomPanel, type RoomPanelProps } from "./RoomPanel.js";

export function ResponsiveRoomPanel(props: RoomPanelProps) {
  const compact = useMediaQuery("(max-width: 1023px)");

  if (!compact) return <RoomPanel {...props} showPlayers={false} />;

  const historyCount = props.room.game?.history.length ?? 0;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="mobile-room-trigger" size="sm" variant="secondary" aria-label={`打开公开记录与房间信息，共 ${historyCount} 条记录`}>
          <Activity className="size-4" />记录 {historyCount}
        </Button>
      </DialogTrigger>
      <DialogContent className="game-info-sheet h-[72dvh] max-h-[72dvh] max-w-none gap-0 overflow-hidden border-[#f7e6bf]/30 bg-[#f8ecd2] p-0 text-[#263d39]">
        <DialogHeader className="sr-only">
          <DialogTitle>公开记录与房间信息</DialogTitle>
          <DialogDescription>查看本局公开事件、房间连接状态和离开操作。</DialogDescription>
        </DialogHeader>
        <RoomPanel {...props} embedded showPlayers={false} />
      </DialogContent>
    </Dialog>
  );
}
