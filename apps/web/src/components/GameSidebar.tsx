import type { GameView } from "@catan/protocol";
import type { ReactNode } from "react";
import { OpponentStrip } from "./OpponentStrip.js";
import { ResponsiveRoomPanel } from "./ResponsiveRoomPanel.js";
import type { RoomPanelProps } from "./RoomPanel.js";

/** One set of player anchors: top strip on phones, stacked rail on desktops. */
export function GameSidebar({ game, bankSupply, ...props }: RoomPanelProps & { readonly game: GameView; readonly bankSupply?: ReactNode }) {
  return (
    <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:gap-2" data-game-sidebar="true">
      <ResponsiveRoomPanel {...props} embedded showPlayers={false} className="min-h-0 flex-1 lg:min-h-60" />
      {bankSupply}
      <OpponentStrip game={game} />
    </div>
  );
}
