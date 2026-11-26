import { lazy, Suspense } from "react";
import { unregisteredGame } from "@catan/protocol/platform";
import type { WaitingProps } from "./components/lobby/RoomLobby.js";

const Catan = lazy(() => import("./games/catan/WaitingRoom.js").then(m => ({ default: m.CatanWaitingRoom })));
const Drawing = lazy(() => import("./games/draw-guess/WaitingRoom.js").then(m => ({ default: m.DrawWaitingRoom })));
const Camel = lazy(() => import("./games/camel-up/WaitingRoom.js").then(m => ({ default: m.CamelWaitingRoom })));
const Carcassonne = lazy(() => import("./games/carcassonne/WaitingRoom.js").then(m => ({ default: m.CarcassonneWaitingRoom })));
const Poker = lazy(() => import("./games/texas-holdem/WaitingRoom.js").then(m => ({ default: m.PokerWaitingRoom })));

export function LobbyRoom(props: WaitingProps) {
  const { room } = props;
  function content() {
    switch (room.gameId) {
      case "catan": return <Catan {...props} room={room} />;
      case "draw-guess": return <Drawing {...props} room={room} />;
      case "camel-up": return <Camel {...props} room={room} />;
      case "carcassonne": return <Carcassonne {...props} room={room} />;
      case "texas-holdem": return <Poker {...props} room={room} />;
      default: return unregisteredGame(room);
    }
  }
  return <Suspense fallback={<main className="grid min-h-svh place-items-center bg-[#173e42] text-[#f5eddb]"><p role="status">正在摆好房间桌面…</p></main>}>{content()}</Suspense>;
}
