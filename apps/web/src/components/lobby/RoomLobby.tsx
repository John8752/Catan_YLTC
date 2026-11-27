import { useRef, useState, type ReactNode } from "react";
import type { AnyRoomView, LobbyMemberView } from "@catan/protocol/platform";
import { getGameDefinition } from "@catan/protocol/platform";
import { Armchair, Copy, Crown, LogOut, Plus, Settings2, Shuffle, Users } from "lucide-react";
import { Button } from "../ui/button.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog.js";
import { DisbandRoomControl } from "../DisbandRoomControl.js";
import type { PlayerSession } from "../../room-session.js";
import { getRoom } from "../../api.js";
import { PLAYER_SVG_COLORS } from "../../lib/player-palette.js";
import { cn } from "../../lib/utils.js";
import { PRESENTATIONS, GAME_TITLE_FONTS } from "./presentation.js";

export interface WaitingProps<R extends AnyRoomView = AnyRoomView> {
  room: R; session: PlayerSession; busy: boolean; error: string | null; connectionState: "connecting" | "live" | "offline"; accountControl: ReactNode;
  setRoom: (room: AnyRoomView) => void; runBusy: (action: () => Promise<void>) => Promise<void>;
  handleStart: () => Promise<void>; handleLeave: () => Promise<void>; handleDisband: () => Promise<void>;
}

/** Refresh a stale revision without throwing away the player's form or seat. */
export async function changeWaitingRoom(props: WaitingProps, action: () => Promise<AnyRoomView>) {
  await props.runBusy(async () => {
    try { props.setRoom(await action()); }
    catch (error) { try { props.setRoom(await getRoom(props.session)); } catch { /* Keep last safe room while reconnecting. */ } throw error; }
  });
}

interface Props extends WaitingProps {
  minPlayers: number; capacity: number; summary: string; settingsHint: string; startLabel: string; preview: ReactNode; settings: ReactNode;
  onShuffle: () => Promise<void>; colorControl?: ReactNode; settingsDirty?: boolean;
  memberAvatar?: (member: LobbyMemberView) => ReactNode;
}

export function RoomLobby(props: Props) {
  const { room, session, busy, connectionState, capacity, minPlayers } = props;
  const host = room.hostPlayerId === session.playerId, game = getGameDefinition(room.gameId), art = PRESENTATIONS[room.gameId];
  const code = useRef<HTMLElement>(null), [copyNotice, setCopyNotice] = useState("");
  const missing = Math.max(0, minPlayers - room.members.length), nextHost = room.members.find(m => m.id !== session.playerId);
  function copyCode() {
    if (!code.current) return;
    const selection = window.getSelection(), range = document.createRange(); range.selectNodeContents(code.current); selection?.removeAllRanges(); selection?.addRange(range);
    try { const copied = document.execCommand("copy"); if (copied) selection?.removeAllRanges(); setCopyNotice(copied ? "房间码已复制" : "已选中房间码，可长按或按 Ctrl+C 复制"); }
    catch { setCopyNotice("已选中房间码，可长按或按 Ctrl+C 复制"); }
  }
  return <main className="min-h-svh text-[#f5eddb] selection:bg-[#efc78b] selection:text-[#233c35]" style={{ backgroundColor: art.backdrop }} data-room-lobby={room.gameId}>
    <div className="mx-auto max-w-[1480px] px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-[max(.75rem,env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-8 lg:px-12">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3 lg:py-4">
        <div className="flex min-w-0 items-center gap-2.5"><Armchair className="size-6 shrink-0 text-[#e3c490]" /><div className="min-w-0"><h1 className={cn("mb-0 text-lg leading-normal sm:text-2xl", GAME_TITLE_FONTS[room.gameId])}>{game.name}</h1><span className="hidden text-caption text-[#d4ded1] sm:block">YLTC 桌游小馆</span></div></div>
        <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg bg-white/8 px-3 py-1.5"><span className="hidden text-xs text-[#d4ded1] sm:inline">房间码</span><strong ref={code} className="room-code select-text font-mono text-lg tracking-[.14em]" aria-label="房间码">{room.id}</strong><button type="button" aria-label="复制房间码" onClick={copyCode} className="grid size-9 place-items-center rounded-md hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#efc78b]"><Copy className="size-4" /></button></div><div className="hidden rounded-lg bg-[#f4eddb] text-[#233c35] sm:block">{props.accountControl}</div></div>
      </header>
      {copyNotice && <p className="mt-2 mb-0 text-right text-xs text-[#eed2a1]" role="status">{copyNotice}</p>}
      {connectionState !== "live" && <p className="mt-3 rounded-xl bg-[#f0dbad] p-3 text-sm text-[#624b2f]" role="status">{connectionState === "connecting" ? "正在恢复房间连接…" : "连接已断开，正在自动重连。恢复后即可操作。"}</p>}
      {props.error && <p className="mt-3 break-words rounded-xl bg-[#f5dacc] p-3 text-sm text-[#853f2b]" role="alert">{props.error}</p>}
      <div className="grid items-start gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-9 lg:pt-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0" aria-label="游戏预览与入座玩家">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2"><h2 className="mb-0 font-display text-[1.375rem] font-semibold leading-relaxed lg:text-3xl">等朋友，一起开桌。</h2><span className="text-ui text-[#d4ded1]">{game.players}</span></div>
          <div className="min-w-0" data-lobby-preview>{props.preview}</div>
          <section className="mt-4 border-t border-white/15 pt-4" aria-label="落座玩家">
            <div className="mb-3 flex items-center justify-between"><h2 className="mb-0 flex items-center gap-2 text-base font-semibold"><Users className="size-4" />同桌朋友 <span className="ml-1 text-sm font-normal tabular-nums text-[#d4ded1]">{room.members.length}/{capacity}</span></h2>{host && <button className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs text-[#d4ded1] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#efc78b]" aria-label="随机打乱玩家顺序" disabled={busy || connectionState !== "live" || room.members.length < 2} onClick={() => void props.onShuffle()}><Shuffle className="size-3.5" />打乱座位</button>}</div>
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="房间玩家">
              {Array.from({ length: capacity }, (_, i) => { const member = room.members[i]; return member ? <li key={member.id} className={cn("flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300", member.id === session.playerId ? "bg-white/13" : "bg-white/6")} data-player-id={member.id} data-current-player={member.id === session.playerId || undefined}>
                {props.memberAvatar ? props.memberAvatar(member) : <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 bg-[#f5e7c8] text-ui font-medium text-[#283d35]" style={{ borderColor: PLAYER_SVG_COLORS[member.color] }} aria-hidden="true">{Array.from(member.name)[0]}</span>}<div className="min-w-0 flex-1"><strong className="block truncate text-ui font-medium" title={member.name}>{member.name}</strong><span className="mt-0.5 flex items-center gap-1 text-caption text-[#d4ded1]">{member.isHost && <Crown className="size-3 text-[#edc883]" />}{member.isHost ? "房主" : "已入座"}{member.id === session.playerId && " · 你"}</span></div>
              </li> : <li key={`empty-${i}`}><button type="button" onClick={copyCode} aria-label={`邀请朋友加入第 ${i + 1} 个座位`} className="flex min-h-[68px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 text-xs text-[#d4ded1] hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-[#efc78b]"><Plus className="size-4" />等朋友入座</button></li>; })}
            </ol>
          </section>
        </section>
        <aside className="min-w-0 rounded-2xl bg-[#f4eddb] p-4 text-[#233c35] shadow-[0_14px_38px_#071e2030] sm:p-5" aria-label="本局设置与房间操作">
          <div className="mb-4 border-b border-[#d4d2c0] pb-4"><h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><Settings2 className="size-5" />本局设置</h2><p className="mb-0 text-ui leading-relaxed text-[#566354]">{props.summary}</p><span className="mt-2 block text-caption text-[#687360]">{props.settingsHint}</span></div>
          {props.settings}
          {props.colorControl && <div className="mt-4 border-t border-[#d4d2c0] pt-3">{props.colorControl}</div>}
          <div className="mt-5 flex items-center gap-2 border-t border-[#d4d2c0] pt-3">
            <Dialog><DialogTrigger asChild><Button variant="ghost" className="min-h-11 flex-1" disabled={busy}><LogOut className="size-4" />离开房间</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>确认离开房间？</DialogTitle><DialogDescription>{host ? nextHost ? `离开后，房主将自动转交给 ${nextHost.name}，你的座位会立即释放。` : "你是最后一名玩家，离开后这个房间会立即关闭。" : "离开后你的座位会立即释放，可以稍后使用房间码重新加入。"}</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button variant="outline">继续留在房间</Button></DialogClose><Button disabled={busy} onClick={() => void props.handleLeave()}>确认离开</Button></DialogFooter></DialogContent></Dialog>
            {host && <DisbandRoomControl room={room} busy={busy} onDisband={props.handleDisband} compact />}
          </div><div className="mt-3 sm:hidden">{props.accountControl}</div>
        </aside>
      </div>
    </div>
    <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#d4d2c0] bg-[#f4eddb] px-[max(1rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] text-[#233c35] shadow-[0_-6px_24px_#071e2018]" aria-label="开局操作">
      <div className="mx-auto flex max-w-[1384px] items-center justify-between gap-4"><div className="min-w-0"><p className="mb-0 text-sm font-semibold" role="status">{missing ? `还差 ${missing} 人就能开局` : "朋友已入座，随时可以开局"}</p><p className="mt-1 mb-0 hidden text-xs text-[#566354] sm:block">把房间码 {room.id} 发给朋友 · 语音使用熟悉的软件</p></div>{host ? <Button className="min-h-12 shrink-0 bg-[#275b50] px-5 text-sm font-semibold text-[#fff9e9] hover:bg-[#1e4a40] sm:min-w-52 sm:text-base" disabled={busy || connectionState !== "live" || missing > 0 || props.settingsDirty} onClick={() => void props.handleStart()}>{busy ? "正在准备…" : props.settingsDirty ? "请先保存设置" : props.startLabel}</Button> : <span className="shrink-0 rounded-xl bg-[#e5ddc8] px-4 py-3 text-sm font-semibold">等待房主开始</span>}</div>
    </footer>
  </main>;
}
