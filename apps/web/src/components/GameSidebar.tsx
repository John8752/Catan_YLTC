import type { GameView } from "@catan/protocol";
import type { ReactNode } from "react";
import { OpponentStrip } from "./OpponentStrip.js";

/** One set of player anchors: top strip on phones, stacked rail on desktops. */
export function GameSidebar({ game, bankSupply, roomControls }: { readonly game: GameView; readonly bankSupply?: ReactNode; readonly roomControls?: ReactNode }) {
  return (
    <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:gap-2" data-game-sidebar="true">
      {roomControls}
      {bankSupply}
      <OpponentStrip game={game} />
    </div>
  );
}
