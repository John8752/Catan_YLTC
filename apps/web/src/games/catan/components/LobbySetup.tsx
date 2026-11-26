import type { RoomView } from "@catan/protocol/catan";
import { RotateCw } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { DEFAULT_BOARD_SCALE, useBoardViewport } from "../use-board-viewport.js";
import { boardViewBox, BoardPorts, BoardTerrain } from "./BoardMap.js";
import { BoardZoomControls } from "./BoardZoomControls.js";
import { MapAnalysisPanel } from "./MapAnalysisPanel.js";

export interface LobbySetupProps {
  readonly room: RoomView;
  readonly isHost: boolean;
  readonly busy: boolean;
  readonly onReroll: () => void;
  readonly contained?: boolean;
}

export function LobbySetup({ room, isHost, busy, onReroll, contained = false }: LobbySetupProps) {
  // Hooks run before the guard below: the preview map is absent for exactly the
  // renders where the game has started, and bailing out first would change the
  // hook order between those two states.
  const viewport = useBoardViewport(contained ? 1 : DEFAULT_BOARD_SCALE);
  if (room.previewMap === null) return null;

  return (
    <section className="board-shell lobby-setup" aria-labelledby="lobby-map-title" style={contained ? { height: "auto", minHeight: 0, width: "100%" } : undefined}>
      <div className="board-heading">
        <div>
          <h2 id="lobby-map-title">出发吧，开拓者们</h2>
          <p className="mt-1 mb-0 text-xs font-medium text-[#d4ded1]" data-map-seed>本局地图 #{room.settings.mapSeed}</p>
        </div>
        {isHost ? (
          <Button
            type="button"
            variant="outline"
            className="border-white/30 bg-white/10 text-[#fff9e8] hover:bg-white/20 hover:text-white"
            disabled={busy}
            onClick={onReroll}
          >
            <RotateCw className="size-4" />
            {busy ? "正在随机…" : "再次随机"}
          </Button>
        ) : <span className="phase-chip">等待房主确认</span>}
      </div>

      <div className="board-stage" {...viewport.viewportProps} style={contained ? { height: "clamp(260px,40svh,380px)", flex: "none", aspectRatio: "auto", minHeight: 0 } : undefined}>
        <div className="board-transform" style={viewport.transformStyle}>
          <svg
            className="board-svg"
            viewBox={boardViewBox(room.previewMap)}
            role="img"
            aria-label={room.previewMap.hexes.length === 19
              ? "由十九块六边形地形组成的开局地图预览"
              : room.previewMap.hexes.length === 30 ? "由三十块六边形地形组成的开局地图预览"
              : `由${room.previewMap.hexes.length}块六边形地形组成的开局地图预览`}
          >
            <defs>
              <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="5" stdDeviation="4" floodOpacity="0.22" />
              </filter>
            </defs>
            <BoardTerrain map={room.previewMap} />
            <BoardPorts map={room.previewMap} />
          </svg>
        </div>
        <BoardZoomControls {...viewport.zoom} />
      </div>
      {contained ? <details className="mt-2 rounded-xl bg-white/5 px-3 py-2"><summary className="cursor-pointer text-sm text-[#f5eddb] focus-visible:outline-2 focus-visible:outline-[#efc78b]">查看地图产能分析</summary><div className="mt-3"><MapAnalysisPanel map={room.previewMap} /></div></details> : <MapAnalysisPanel map={room.previewMap} />}
      <p className="board-instruction">
        开局会原样使用这张地图。重新随机只会更换地图，不会影响已落座玩家。
      </p>
    </section>
  );
}
