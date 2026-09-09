import type { PublicPlayerView } from "@catan/protocol";
import type { ReactElement } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.js";
import { PlayerColorDot } from "./PlayerColorDot.js";
import { PlayerPublicStats } from "./PlayerPublicStats.js";

export function PlayerDetails({ player, children }: { readonly player: PublicPlayerView; readonly children: ReactElement }) {
  return <Dialog>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="max-h-[80dvh] overflow-y-auto border-[#d0b98b] bg-[#fff3db] text-[#294b43] sm:max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><PlayerColorDot color={player.color} />{player.name}</DialogTitle>
        <DialogDescription>公开信息，分数不含隐藏胜利点。</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div>公开分数<strong className="block text-xl">{player.visibleVictoryPoints}</strong></div>
        <div>资源卡<strong className="block text-xl">{player.resourceCardCount}</strong></div>
        <div>发展卡<strong className="block text-xl">{player.developmentCardCount}</strong></div>
      </div>
      <PlayerPublicStats player={player} tone="light" density="comfortable" className="[&>span]:flex-col [&>span]:items-center [&>span]:gap-2 [&>span]:py-3 [&>span]:text-xs [&_b]:text-lg" />
    </DialogContent>
  </Dialog>;
}
