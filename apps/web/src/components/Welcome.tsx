import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { GAME_CATALOG, DEFAULT_GAME_ID, getGameDefinition, type GameType } from "@catan/protocol/platform";
import { Armchair, LogIn, Plus, Users } from "lucide-react";
import { cn } from "../lib/utils.js";
import { WorldPreview } from "./lobby/WorldPreview.js";
import { PRESENTATIONS, entryField } from "./lobby/presentation.js";

export interface WelcomeProps {
  readonly accountControl?: ReactNode; readonly compactAccountControl?: ReactNode; readonly defaultPlayerName?: string; readonly busy: boolean; readonly error: string | null;
  readonly onCreate: (playerName: string, gameId: GameType) => void; readonly onJoin: (roomId: string, playerName: string) => void;
}
export function Welcome({ busy, error, onCreate, onJoin, accountControl, compactAccountControl, defaultPlayerName = "" }: WelcomeProps) {
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState<GameType>(DEFAULT_GAME_ID);
  const [roomId, setRoomId] = useState("");
  const roomInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (defaultPlayerName) setPlayerName(defaultPlayerName); }, [defaultPlayerName]);
  const game = getGameDefinition(gameId), art = PRESENTATIONS[gameId];
  function handleCreate(e: FormEvent<HTMLFormElement>) { e.preventDefault(); onCreate(playerName, gameId); }
  function handleJoin(e: FormEvent<HTMLFormElement>) { e.preventDefault(); onJoin(roomId.trim().toUpperCase(), playerName); }
  return <main className="min-h-svh overflow-x-clip text-[#f5eddb] selection:bg-[#efc78b] selection:text-[#233c35] motion-safe:transition-colors motion-safe:duration-700" style={{ backgroundColor: art.backdrop }} data-lobby-home>
    <div className="mx-auto flex min-h-svh max-w-[1560px] flex-col px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12">
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-[#f5eddb]/15 pb-3 lg:min-h-20 lg:pb-5">
        <div className="flex items-center gap-2.5"><Armchair className="size-7 text-[#e2c38e]" strokeWidth={1.5} /><span className="whitespace-nowrap text-sm font-bold tracking-wide sm:text-base">YLTC 桌游小馆</span></div>
        <div className="flex items-center gap-2 sm:gap-4"><button type="button" onClick={() => roomInput.current?.focus()} className="flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#efc78b]"><LogIn className="size-4" /><span className="hidden sm:inline">输入房间码</span><span className="sm:hidden">加入</span></button><div className="rounded-lg bg-[#f4eddb] text-[#233c35] [&_button]:min-h-10 [&_button]:px-2 [&_button]:text-xs sm:[&_button]:px-3 sm:[&_button]:text-sm"><span className={compactAccountControl ? "hidden sm:block" : "block"}>{accountControl}</span>{compactAccountControl && <span className="block sm:hidden">{compactAccountControl}</span>}</div></div>
      </header>
      <div className="grid flex-1 items-center gap-x-10 py-4 lg:grid-cols-[minmax(0,1fr)_350px] lg:py-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-x-16">
        <section className="min-w-0 lg:self-stretch" aria-label="选择今晚的游戏">
          <div className="flex items-end justify-between gap-4 lg:pt-4"><div><h1 className="mb-1 text-[clamp(1.8rem,3.3vw,3.25rem)] font-bold leading-tight tracking-tight">今晚，开哪一桌？</h1><p className="mb-0 mt-2 hidden text-base text-[#d9e1d4] sm:block">选个游戏，把朋友叫到桌边。</p></div><span className="mb-1 hidden shrink-0 text-sm text-[#d9e1d4] xl:block">朋友到齐就开桌</span></div>
          <WorldPreview gameId={gameId} className="h-[clamp(200px,31svh,320px)] sm:h-[360px] lg:h-[clamp(330px,48vh,550px)]" />
          <fieldset disabled={busy} className="grid grid-cols-5 gap-1.5 sm:gap-3" aria-label="选择游戏">
            <legend className="sr-only">选择游戏</legend>
            {GAME_CATALOG.map((item) => { const GameIcon = PRESENTATIONS[item.id].icon, active = gameId === item.id; return <label key={item.id} className={cn("relative flex min-h-[76px] min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-1 py-3 text-center motion-safe:transition-colors sm:min-h-24 sm:gap-3 sm:py-4", active ? "border-[#e4c898] bg-[#f2dfb8] text-[#243f37] shadow-[0_6px_18px_#071e2030]" : "border-[#f5eddb]/20 bg-[#f5eddb]/5 text-[#e3e5d9] hover:border-[#f5eddb]/60 hover:bg-[#f5eddb]/10", busy && "cursor-wait opacity-65")}>
              <input className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0" type="radio" name="game" value={item.id} checked={active} onChange={() => setGameId(item.id)} aria-label={item.name} />
              <GameIcon className="size-6 sm:size-7" strokeWidth={1.6} aria-hidden="true" /><span className="whitespace-nowrap text-xs font-semibold sm:text-sm">{item.name}</span><span className="pointer-events-none absolute inset-[-3px] rounded-[15px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#f1d29c]" />
            </label>; })}
          </fieldset>
        </section>
        <section className="mt-5 min-w-0 lg:mt-0" aria-label="创建或加入房间">
          <div className="mb-5 hidden lg:block"><h2 className="mb-3 text-balance text-[2.5rem] font-bold leading-tight">{art.subtitle}</h2></div>
          <div className="rounded-2xl bg-[#f4eddb] p-4 text-[#233c35] shadow-[0_18px_45px_#041e2230] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="mb-0 text-xl font-bold" aria-live="polite">{game.name}</h2><span className="flex shrink-0 items-center gap-1.5 text-sm text-[#566354]"><Users className="size-4" />{game.players}</span></div>
            <p className="mb-5 text-sm leading-6 text-[#566354]">{game.description}</p>
            <label className="mb-2 block text-sm font-semibold" htmlFor="player-name">显示名称</label>
            <input id="player-name" className={entryField} value={playerName} maxLength={24} placeholder="朋友怎么称呼你？" autoComplete="nickname" onChange={(e) => setPlayerName(e.target.value)} disabled={busy} />
            <form onSubmit={handleCreate} className="mt-3"><button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#275b50] px-3 text-base font-bold text-[#fff9e9] hover:bg-[#1e4a40] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#275b50]" type="submit" disabled={busy || !playerName.trim()}><Plus className="size-5" />{busy ? "正在准备桌面…" : `创建${game.name}房间`}</button></form>
            <div className="my-5 flex items-center gap-3 text-xs text-[#687360]"><span className="h-px flex-1 bg-[#d4d2c0]" />朋友已经开桌了？<span className="h-px flex-1 bg-[#d4d2c0]" /></div>
            <form onSubmit={handleJoin}><label htmlFor="room-code" className="mb-2 block text-sm font-semibold">六位房间码</label><div className="flex gap-2"><input ref={roomInput} id="room-code" className={cn(entryField, "min-w-0 flex-1 font-mono tracking-[.16em] uppercase")} value={roomId} maxLength={6} placeholder="A1B2C3" autoComplete="off" autoCapitalize="characters" onChange={(e) => setRoomId(e.target.value.toUpperCase())} disabled={busy} /><button className="min-h-12 shrink-0 rounded-xl bg-[#ddd1b6] px-4 text-sm font-bold text-[#354b3a] hover:bg-[#d0c3a5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#275b50]" type="submit" disabled={busy || !playerName.trim() || roomId.trim().length !== 6}>加入房间</button></div></form>
            {error && <p className="mt-4 mb-0 rounded-lg bg-[#f5dacc] p-3 text-sm text-[#853f2b]" role="alert">{error}</p>}
          </div>
          <p className="mt-4 mb-0 text-center text-xs leading-5 text-[#d9e1d4]">无需注册 · 语音请用你们熟悉的软件</p>
        </section>
      </div>
      <footer className="mt-4 hidden items-center justify-between border-t border-[#f5eddb]/15 py-4 text-xs text-[#c5d2c6] lg:flex"><span>小小一张桌，装下今晚的好时光。</span><span>房间创建后，游戏保持不变</span></footer>
    </div>
  </main>;
}
