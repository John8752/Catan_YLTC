import type { RoomView } from "@catan/protocol";
import type { ReactNode } from "react";
import { Activity, Crown, LogOut, Route, Settings2, ShieldCheck, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card.js";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";
import { ScrollArea } from "@/components/ui/scroll-area.js";
import { Separator } from "@/components/ui/separator.js";
import { cn } from "@/lib/utils.js";

export interface RoomPanelProps {
  readonly room: RoomView;
  readonly playerId: string;
  readonly connectionState: "connecting" | "live" | "offline";
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly onSettingsChange: (settings: {
    playerLimit: 3 | 4;
    victoryPointsToWin: number;
  }) => void;
  readonly onLeave: () => void | Promise<void>;
}

const PLAYER_COLORS = {
  terracotta: "bg-[#c85d42]",
  ocean: "bg-[#3886a5]",
  pine: "bg-[#3f8057]",
  wheat: "bg-[#d2a534]",
  plum: "bg-[#81577d]",
  charcoal: "bg-[#48504f]",
} as const;

export function RoomPanel({
  room,
  playerId,
  connectionState,
  busy,
  onStart,
  onSettingsChange,
  onLeave,
}: RoomPanelProps) {
  const isHost = room.hostPlayerId === playerId;
  const canStart = isHost && room.members.length >= 3 && room.game === null;

  return (
    <aside className="min-h-0 lg:col-start-2 lg:row-span-3 lg:row-start-1" aria-label="房间状态">
      <Card className="min-h-0 gap-0 overflow-hidden border-white/20 bg-[#f3e6c8]/96 py-0 shadow-2xl backdrop-blur-sm lg:h-full">
        <CardHeader className="border-b border-[#5f4b31]/15 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-[11px] font-black tracking-[.18em] text-[#aa543d] uppercase">房间码</p>
              <strong className="room-code font-serif text-2xl tracking-[.16em] text-[#163c3a]">{room.id}</strong>
            </div>
            <Badge variant="outline" className="gap-1.5 border-[#386f62]/25 bg-white/35 text-[#37685d]">
              <span className={cn(
                "size-2 rounded-full",
                connectionState === "live" ? "bg-emerald-600" : connectionState === "connecting" ? "bg-amber-500" : "bg-stone-400",
              )} />
              {connectionState === "live" ? "实时" : connectionState === "connecting" ? "连接中" : "离线"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3">
          {room.game === null ? null : (
            <section className="flex min-h-0 flex-col lg:flex-1" aria-label="公开记录">
              <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
                <span className="flex items-center gap-2"><Activity className="size-4 text-[#b45c42]" />公开记录</span>
                <span>{room.game.history.length}</span>
              </div>
              <ScrollArea className="h-72 rounded-xl border border-[#6d5434]/15 bg-white/35 lg:h-auto lg:min-h-36 lg:flex-1">
                <ol className="space-y-0 px-3 py-2 text-sm" aria-live="polite">
                  {[...room.game.history].slice(-30).reverse().map((entry, index) => (
                    <li
                      className="border-b border-[#6d5434]/10 py-2.5 leading-relaxed text-[#47534e] last:border-0"
                      key={`${entry.revision}-${entry.type}-${index}`}
                    >
                      {entry.message}
                      {entry.privateDetail === null ? null : (
                        <span className="mt-1 block text-xs font-bold text-[#a34e39]">{entry.privateDetail}</span>
                      )}
                    </li>
                  ))}
                  {room.game.history.length === 0 ? <li className="py-8 text-center text-[#7c817a]">对局记录会显示在这里</li> : null}
                </ol>
              </ScrollArea>
              <Separator className="mt-4 bg-[#6d5434]/15" />
            </section>
          )}

          {room.game === null ? (
            <section aria-label="房间设置">
              <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
                <span className="flex items-center gap-2"><Settings2 className="size-4 text-[#b45c42]" />房间设置</span>
                <span>{isHost ? "房主可调整" : "由房主设置"}</span>
              </div>
              <div className="space-y-1 rounded-xl border border-[#695237]/15 bg-white/35 p-3">
                <SettingRow label="规则版本">
                  <Badge variant="outline" className="border-[#386f62]/20 bg-white/35 text-[#37685d]">基础版 3–4 人</Badge>
                </SettingRow>
                <SettingRow label="人数上限">
                  <div className="flex rounded-lg bg-[#ded0b2]/60 p-1" aria-label="人数上限">
                    {([3, 4] as const).map((playerLimit) => (
                      <Button
                        key={playerLimit}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-7 min-w-10 rounded-md px-3 text-xs",
                          room.settings.playerLimit === playerLimit
                            ? "bg-[#37685d] text-white hover:bg-[#315d53] hover:text-white"
                            : "text-[#53665f] hover:bg-white/55",
                        )}
                        aria-pressed={room.settings.playerLimit === playerLimit}
                        disabled={!isHost || busy || room.members.length > playerLimit}
                        onClick={() => onSettingsChange({
                          playerLimit,
                          victoryPointsToWin: room.settings.victoryPointsToWin,
                        })}
                      >
                        {playerLimit} 人
                      </Button>
                    ))}
                  </div>
                </SettingRow>
                <SettingRow label="获胜分数" icon={<Trophy className="size-3.5 text-[#ba8131]" />}>
                  <select
                    className="h-8 rounded-lg border border-[#695237]/20 bg-[#fffaf0]/80 px-2 text-sm font-bold text-[#29433d] outline-none focus-visible:ring-2 focus-visible:ring-[#37685d]/45 disabled:cursor-not-allowed disabled:opacity-65"
                    aria-label="获胜分数"
                    value={room.settings.victoryPointsToWin}
                    disabled={!isHost || busy}
                    onChange={(event) => onSettingsChange({
                      playerLimit: room.settings.playerLimit,
                      victoryPointsToWin: Number(event.target.value),
                    })}
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 5).map((score) => (
                      <option key={score} value={score}>{score} 分</option>
                    ))}
                  </select>
                </SettingRow>
              </div>
            </section>
          ) : null}

          <section aria-label="落座玩家">
            <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
              <span className="flex items-center gap-2"><Users className="size-4 text-[#b45c42]" />落座玩家</span>
              <span>{room.members.length}/{room.settings.playerLimit}</span>
            </div>
            <div className="space-y-1">
              {room.members.map((member) => {
                const gamePlayer = room.game?.players.find((player) => player.id === member.id);
                return (
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2",
                    member.id === playerId ? "bg-white/55 ring-1 ring-[#5b7f73]/20" : "bg-transparent",
                  )} key={member.id} data-player-id={member.id} data-player-target={member.id} data-current-player={member.id === playerId ? "true" : undefined}>
                    <span className={cn("size-3.5 shrink-0 rounded-[5px] shadow-sm ring-2 ring-white/70", PLAYER_COLORS[member.color])} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <strong className="truncate text-sm text-[#263d39]">{member.name}</strong>
                        {member.isHost ? <Crown className="size-3.5 text-[#ba8131]" aria-label="房主" /> : null}
                      </div>
                      <span className="text-[11px] text-[#757b73]">{member.id === playerId ? "你" : "玩家"}</span>
                    </div>
                    {gamePlayer === undefined ? null : (
                      <div className="text-right">
                        <strong className="block text-sm text-[#253d39]">{gamePlayer.visibleVictoryPoints} 分</strong>
                        <span className="block text-[10px] text-[#777c75]">{gamePlayer.resourceCardCount} 资源 · {gamePlayer.developmentCardCount} 发展</span>
                        <span className="flex justify-end gap-1 text-[10px] font-bold text-[#9b503a]">
                          {room.game?.awards.longestRoad.holderId === gamePlayer.id ? <Route className="size-3.5" aria-label="最长道路" /> : null}
                          {room.game?.awards.largestArmy.holderId === gamePlayer.id ? <ShieldCheck className="size-3.5" aria-label="最大骑士力" /> : null}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {room.game === null ? (
            <div className="mt-auto rounded-xl border border-[#695237]/15 bg-white/35 p-3 text-center text-sm text-[#6e746d]">
              {isHost ? (
                <>
                  <Button className="w-full" disabled={!canStart || busy} onClick={onStart}>
                    {room.members.length < 3 ? "等待至少 3 人" : busy ? "正在开局…" : "使用当前地图开局"}
                  </Button>
                  <p className="mt-2 mb-0 text-xs">
                    当前地图 · {room.settings.playerLimit} 人上限 · {room.settings.victoryPointsToWin} 分获胜
                  </p>
                </>
              ) : <p className="mb-0">等待房主开局。把房间码发给朋友即可加入。</p>}
            </div>
          ) : null}
        </CardContent>

        {room.game === null ? (
          <CardFooter className="border-t border-[#5f4b31]/15 px-5 py-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full text-[#3f5b55] hover:bg-white/45"
                  disabled={busy}
                >
                  <LogOut className="size-4" />离开房间
                </Button>
              </DialogTrigger>
              <DialogContent className="border-[#f7e6bf]/30 bg-[#f8ecd2] text-[#263d39] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>确认离开房间？</DialogTitle>
                  <DialogDescription className="leading-relaxed text-[#66716b]">
                    {leaveDescription(room, isHost)}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">继续留在房间</Button>
                  </DialogClose>
                  <Button
                    type="button"
                    className="bg-[#a94f3a] text-white hover:bg-[#93432f]"
                    disabled={busy}
                    onClick={onLeave}
                  >
                    {busy ? "正在离开…" : "确认离开"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardFooter>
        ) : null}
      </Card>
    </aside>
  );
}

function leaveDescription(room: RoomView, isHost: boolean): string {
  if (!isHost) return "离开后你的座位会立即释放，你可以稍后使用房间码重新加入。";
  const nextHost = room.members.find((member) => member.id !== room.hostPlayerId);
  if (nextHost === undefined) return "你是房间中的最后一名玩家。离开后，这个房间会立即关闭。";
  return `离开后，房主将自动转交给 ${nextHost.name}，你的座位会立即释放。`;
}

function SettingRow({
  label,
  icon,
  children,
}: {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-sm font-bold text-[#53625d]">{icon}{label}</span>
      {children}
    </div>
  );
}
