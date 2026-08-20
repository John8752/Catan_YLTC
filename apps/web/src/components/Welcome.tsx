import { type FormEvent, useState } from "react";

export interface WelcomeProps {
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCreate: (playerName: string) => void;
  readonly onJoin: (roomId: string, playerName: string) => void;
}

const TABLE_LEGENDS = [
  { name: "wjw", story: "在北岸找第一条路" },
  { name: "zxc", story: "把砖和木算得明明白白" },
  { name: "zzx", story: "相信下一次骰声会转运" },
  { name: "qyp", story: "能把一只羊谈成未来" },
  { name: "zj", story: "安静地把道路铺向远方" },
  { name: "yst", story: "专等七点掀翻全桌计划" },
] as const;

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
        <p className="eyebrow">六人远征队 · 随时开岛</p>
        <h1>六个人，<br />一座不肯安静的岛。</h1>
        <p className="welcome-lead">
          今晚，友谊按资源计价，承诺写在道路上。谁先把胜利握在手里，谁就负责讲述这座岛真正发生过什么。
        </p>

        <div className="mt-7 max-w-[38rem] border-l border-[#efbd79]/45 pl-4" aria-label="今晚的六位开拓者">
          <p className="mb-2 text-[11px] font-black tracking-[.16em] text-[#efbd79] uppercase">桌边传说</p>
          <ul className="m-0 grid list-none gap-x-6 gap-y-1.5 p-0 sm:grid-cols-2">
            {TABLE_LEGENDS.map((legend) => (
              <li className="flex min-w-0 items-baseline gap-2 text-sm" key={legend.name}>
                <strong className="w-8 shrink-0 font-serif tracking-wide text-[#fff4d6]">{legend.name}</strong>
                <span className="truncate text-white/62">{legend.story}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="milestone-note">
          <span className="whitespace-nowrap">今晚规则</span>
          <p>3–6 人都能上桌，地图会尽量公平；至于交易是否公平，全看你们。</p>
        </div>
      </section>

      <section className="entry-panel" aria-label="创建或加入房间">
        <div className="entry-heading">
          <span className="brand-mark" aria-hidden="true">⬡</span>
          <div>
            <p className="eyebrow">YLTC 六人局</p>
            <h2>报上名号，准备登岛</h2>
          </div>
        </div>

        <label className="field-label" htmlFor="player-name">显示名称</label>
        <input
          id="player-name"
          className="text-input"
          value={playerName}
          maxLength={24}
          placeholder="例如：wjw"
          autoComplete="nickname"
          onChange={(event) => setPlayerName(event.target.value)}
        />

        <form onSubmit={handleCreate}>
          <button className="primary-button" type="submit" disabled={busy || playerName.trim().length === 0}>
            {busy ? "正在准备桌面…" : "创建今晚的岛"}
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
              登岛
            </button>
          </div>
        </form>

        {error === null ? null : <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
