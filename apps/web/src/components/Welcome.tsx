import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { GAME_CATALOG, type GameType } from "@catan/protocol/platform";
import { cn } from "../lib/utils.js";

export interface WelcomeProps {
  readonly accountControl?: ReactNode;
  readonly defaultPlayerName?: string;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onCreate: (playerName: string, gameId: GameType) => void;
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

export function Welcome({ busy, error, onCreate, onJoin, accountControl, defaultPlayerName = "" }: WelcomeProps) {
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState<GameType>("catan");
  useEffect(() => { if (defaultPlayerName) setPlayerName(defaultPlayerName); }, [defaultPlayerName]);
  const [roomId, setRoomId] = useState("");

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(playerName, gameId);
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onJoin(roomId.trim().toUpperCase(), playerName);
  }

  return (
    <main className="welcome-layout">
      <section className="welcome-copy">
        <p className="eyebrow">YLTC 桌游小馆 · 朋友到齐就开桌</p>
        <h1>朋友在语音里，<br />快乐在桌面上。</h1>
        <p className="welcome-lead">
          今晚想认真经营一座岛，还是把一句话画到面目全非？选个游戏，发出房间码，和熟悉的人一起玩。
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
          <span className="whitespace-nowrap">开桌约定</span>
          <p>创建时选定游戏，房间内不再更换。语音照常用你们熟悉的软件；本站无需麦克风权限。</p>
        </div>
      </section>

      <section className="entry-panel" aria-label="创建或加入房间">
        <div className="entry-heading">
          <span className="brand-mark" aria-hidden="true">⬡</span>
          <div>
            <p className="eyebrow">YLTC 六人局</p>
            <h2>报上名号，准备开桌</h2>
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
          <fieldset className="my-4 grid gap-2" disabled={busy}>
            <legend className="mb-2 text-sm font-bold">选择游戏</legend>
            {GAME_CATALOG.map((game) => <label key={game.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left", gameId === game.id ? "border-primary bg-primary/10" : "border-border")}>
              <input className="mt-1 size-4 shrink-0 accent-primary" type="radio" name="game" value={game.id} checked={gameId === game.id} onChange={() => setGameId(game.id)} />
              <span className="min-w-0"><span className="flex flex-wrap items-baseline gap-x-3"><strong>{game.name}</strong><small>{game.players}</small></span><span className="mt-1 block text-sm opacity-75">{game.description}</span></span>
            </label>)}
          </fieldset>
          <button className="primary-button" type="submit" disabled={busy || playerName.trim().length === 0}>
            {busy ? "正在准备桌面…" : gameId === "catan" ? "创建今晚的岛" : "创建传画猜词房间"}
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

        <div className="mt-4 flex justify-center">{accountControl}</div>
        {error === null ? null : <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
