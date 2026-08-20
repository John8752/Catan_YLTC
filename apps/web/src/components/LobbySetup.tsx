import type { RoomView } from "@catan/protocol";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { boardViewBox, BoardPorts, BoardTerrain } from "./BoardMap.js";
import { MapAnalysisPanel } from "./MapAnalysisPanel.js";

export interface LobbySetupProps {
  readonly room: RoomView;
  readonly isHost: boolean;
  readonly busy: boolean;
  readonly onReroll: () => void;
}

export function LobbySetup({ room, isHost, busy, onReroll }: LobbySetupProps) {
  if (room.previewMap === null) return null;

  return (
    <section className="board-shell lobby-setup" aria-labelledby="lobby-map-title">
      <div className="board-heading">
        <div>
          <p className="eyebrow">今晚的岛屿 · 地图 #{room.settings.mapSeed}</p>
          <h2 id="lobby-map-title">出发吧，开拓者们</h2>
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

      <div className="board-stage">
        <svg
          className="board-svg"
          viewBox={boardViewBox(room.previewMap)}
          role="img"
          aria-label={room.previewMap.hexes.length === 19
            ? "由十九块六边形地形组成的开局地图预览"
            : "由三十块六边形地形组成的开局地图预览"}
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
      <MapAnalysisPanel map={room.previewMap} />
      <p className="board-instruction">
        开局会原样使用这张地图。重新随机只会更换地图，不会影响已落座玩家。
      </p>
    </section>
  );
}
