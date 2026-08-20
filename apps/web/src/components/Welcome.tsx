import { type FormEvent, useState } from "react";

export interface WelcomeProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCreate: (playerName: string) => void;
  readonly onJoin: (roomId: string, playerName: string) => void;
}

export function Welcome({ busy, error, onCreate, onJoin }: WelcomeProps) {
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(playerName);
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoin(roomId.trim().toUpperCase(), playerName);
  }

  return (
    <main className="welcome-layout">
      <section className="welcome-copy">
        <p className="eyebrow">围桌而坐 · 即开即玩</p>
        <h1>把一座新岛，<br />变成你们的故事。</h1>
        <p className="welcome-lead">
          创建一个私人房间，邀请朋友落座。规则引擎、实时同步和断线恢复会从第一天被当作同一件事设计。
        </p>
        <div className="milestone-note">
          <span>可玩版</span>
          <p>3–4 人基础岛与 5–6 人扩展岛均可游玩；地图、资源、交易、双玩家回合与胜负都由服务器统一裁定。</p>
        </div>
      </section>

      <section className="entry-panel" aria-label="创建或加入房间">
        <div className="entry-heading">
          <span className="brand-mark" aria-hidden="true">⬡</span>
          <div>
            <p className="eyebrow">Catan YLTC</p>
            <h2>先选一个桌边名字</h2>
          </div>
        </div>

        <label className="field-label" htmlFor="player-name">显示名称</label>
        <input
          id="player-name"
          className="text-input"
          value={playerName}
          maxLength={24}
          placeholder="例如：北港木匠"
          autoComplete="nickname"
          onChange={(event) => setPlayerName(event.target.value)}
        />

        <form onSubmit={handleCreate}>
          <button className="primary-button" type="submit" disabled={busy || playerName.trim().length === 0}>
            {busy ? "正在准备桌面…" : "创建私人房间"}
          </button>
        </form>

        <div className="divider"><span>或加入朋友</span></div>

        <form className="join-form" onSubmit={handleJoin}>
          <label className="field-label" htmlFor="room-code">六位房间码</label>
          <div className="join-row">
            <input
              id="room-code"
              className="text-input code-input"
              value={roomId}
              maxLength={6}
              placeholder="A1B2C3"
              onChange={(event) => setRoomId(event.target.value.toUpperCase())}
            />
            <button
              className="secondary-button"
              type="submit"
              disabled={busy || playerName.trim().length === 0 || roomId.trim().length !== 6}
            >
              加入
            </button>
          </div>
        </form>

        {error === null ? null : <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
