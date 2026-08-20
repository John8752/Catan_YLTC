import type { GameCommand, RoomView } from "@catan/protocol";
import { GameControls } from "./GameControls.js";

export interface RoomPanelProps {
  readonly room: RoomView;
  readonly playerId: string;
  readonly connectionState: "connecting" | "live" | "offline";
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly onLeave: () => void;
  readonly onGameCommand: (command: GameCommand) => void;
  readonly buildMode: "road" | "settlement" | "city" | null;
  readonly onBuildModeChange: (mode: "road" | "settlement" | "city" | null) => void;
}

export function RoomPanel({
  room,
  playerId,
  connectionState,
  busy,
  onStart,
  onLeave,
  onGameCommand,
  buildMode,
  onBuildModeChange,
}: RoomPanelProps) {
  const isHost = room.hostPlayerId === playerId;
  const canStart = isHost && room.members.length >= 3 && room.game === null;

  return (
    <aside className="room-panel" aria-label="房间状态">
      <div className="room-code-block">
        <div>
          <p className="eyebrow">房间码</p>
          <strong className="room-code">{room.id}</strong>
        </div>
        <span className={`connection-dot is-${connectionState}`}>
          {connectionState === "live" ? "实时" : connectionState === "connecting" ? "连接中" : "离线"}
        </span>
      </div>

      <div className="player-list">
        <div className="section-label">
          <span>落座玩家</span>
          <span>{room.members.length}/4</span>
        </div>
        {room.members.map((member) => {
          const gamePlayer = room.game?.players.find((player) => player.id === member.id);

          return (
            <div className="player-row" key={member.id}>
              <span className={`player-pawn color-${member.color}`} aria-hidden="true" />
              <div className="player-name">
                <strong>{member.name}</strong>
                <small>
                  {member.isHost ? "房主" : "玩家"}
                  {member.id === playerId ? " · 你" : ""}
                </small>
              </div>
              {gamePlayer === undefined ? null : (
                <span className="resource-count" title="资源卡与发展卡数量">
                  {gamePlayer.resourceCardCount} 资源 · {gamePlayer.developmentCardCount} 发展
                </span>
              )}
            </div>
          );
        })}
      </div>

      {room.game === null ? (
        <div className="room-action">
          {isHost ? (
            <>
              <button className="primary-button" type="button" disabled={!canStart || busy} onClick={onStart}>
                {room.members.length < 3 ? "等待至少 3 人" : busy ? "正在开局…" : "生成岛屿并开局"}
              </button>
              <p>当前里程碑支持 3–4 人基础棋盘。</p>
            </>
          ) : (
            <p>等待房主开局。把房间码发给朋友即可加入。</p>
          )}
        </div>
      ) : (
        <>
          <div className="your-hand">
            <p className="section-label">你的资源</p>
            <div className="resource-grid">
              {Object.entries(room.game.you.resources).map(([resource, count]) => (
                <span key={resource} className={`resource-chip resource-${resource}`}>
                  {resourceLabel(resource)} <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="room-action game-actions">
            {room.game.lastRoll === null ? null : (
              <p className="dice-result">骰子：{room.game.lastRoll[0]} + {room.game.lastRoll[1]}</p>
            )}
            <GameControls
              game={room.game}
              busy={busy}
              onCommand={onGameCommand}
              buildMode={buildMode}
              onBuildModeChange={onBuildModeChange}
            />
            <p>{room.game.interaction.instruction}</p>
          </div>
        </>
      )}

      <button className="quiet-button" type="button" onClick={onLeave}>
        离开当前标签页会话
      </button>
    </aside>
  );
}

function resourceLabel(resource: string): string {
  return {
    brick: "砖",
    lumber: "木",
    wool: "羊",
    grain: "麦",
    ore: "矿",
  }[resource] ?? resource;
}
