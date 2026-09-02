import type { PlayerColor } from "@catan/game-core";
import type { RoomSettingsInput, RoomView } from "@catan/protocol";
import type { ReactNode } from "react";
import { Crown, LogOut, Route, Settings2, ShieldCheck, Shuffle, Trophy, Users } from "lucide-react";
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
import { cn } from "@/lib/utils.js";
import { DisbandRoomControl } from "./DisbandRoomControl.js";
import { PlayerColorPicker } from "./PlayerColorPicker.js";
import { PlayerSettlementIcon } from "./PlayerSettlementIcon.js";
import { PublicHistory } from "./PublicHistory.js";

export interface RoomPanelProps {
  readonly room: RoomView;
  readonly playerId: string;
  readonly connectionState: "connecting" | "live" | "offline";
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly onSettingsChange: (settings: RoomSettingsInput) => void;
  readonly onPlayerColorChange: (color: PlayerColor) => void;
  readonly onShufflePlayers: () => void;
  readonly onLeave: () => void | Promise<void>;
  readonly onDisband: () => void | Promise<void>;
  readonly embedded?: boolean;
  readonly showPlayers?: boolean;
  readonly className?: string;
  readonly headerAction?: ReactNode;
}

export function RoomPanel({
  room,
  playerId,
  connectionState,
  busy,
  onStart,
  onSettingsChange,
  onPlayerColorChange,
  onShufflePlayers,
  onLeave,
  onDisband,
  embedded = false,
  showPlayers = true,
  className,
  headerAction,
}: RoomPanelProps) {
  const isHost = room.hostPlayerId === playerId;
  const minimumPlayers = room.settings.ruleProfile === "extended-5-6" ? 5 : 2;
  const canStart = isHost && room.members.length >= minimumPlayers && room.game === null;
  const settings: RoomSettingsInput = {
    ruleProfile: room.settings.ruleProfile,
    victoryPointsToWin: room.settings.victoryPointsToWin,
    bankCountsPublic: room.settings.bankCountsPublic,
  };

  return (
    <aside className={cn("flex min-h-0 flex-col", !embedded && "lg:col-start-2 lg:row-span-3 lg:row-start-1", className)} aria-label="房间状态">
      <Card className={cn("min-h-0 flex-1 gap-0 overflow-hidden border-white/20 bg-[#f3e6c8]/96 py-0 shadow-2xl backdrop-blur-sm", !embedded && "lg:h-full", embedded && "lg:rounded-none lg:border-transparent lg:bg-transparent lg:shadow-none lg:backdrop-blur-none")}>
        <CardHeader className={cn("border-b border-[var(--sidebar-line,#5f4b3126)] px-5 py-4", room.game !== null && "grid-rows-1 gap-0 px-3 py-2 [.border-b]:pb-2")}>
          <div className="flex items-start justify-between gap-4">
            <div className={cn("min-w-0", room.game !== null && "flex shrink-0 items-baseline gap-2 whitespace-nowrap")}>
              <p className={cn("mb-1 text-[11px] font-black tracking-[.18em] text-[var(--sidebar-muted,#aa543d)] uppercase", room.game !== null && "mb-0")}>房间码</p>
              <strong className={cn("room-code font-serif text-2xl tracking-[.16em] text-[var(--sidebar-ink,#163c3a)]", room.game !== null && "text-lg")}>{room.id}</strong>
            </div>
            <div className="flex items-center gap-1">
              {headerAction}
              <Badge variant="outline" className="gap-1.5 border-[var(--sidebar-line,#386f6240)] bg-[var(--sidebar-soft,#ffffff59)] text-[var(--sidebar-muted,#37685d)]">
                <span className={cn(
                  "size-2 rounded-full",
                  connectionState === "live" ? "bg-emerald-600" : connectionState === "connecting" ? "bg-amber-500" : "bg-stone-400",
                )} />
                {connectionState === "live" ? "实时" : connectionState === "connecting" ? "连接中" : "离线"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3", room.game !== null && "overflow-hidden px-3 py-2")}>
          {room.game === null ? null : <PublicHistory key={room.game.id} history={room.game.history} />}

          {room.game === null ? (
            <section aria-label="房间设置">
              <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
                <span className="flex items-center gap-2"><Settings2 className="size-4 text-[#b45c42]" />房间设置</span>
                <span>{isHost ? "房主可调整" : "由房主设置"}</span>
              </div>
              <div className="space-y-1 rounded-xl border border-[#695237]/15 bg-white/35 p-3">
                <SettingRow label="牌桌规模">
                  <div className="flex rounded-lg bg-[#ded0b2]/60 p-1" aria-label="牌桌规模">
                    {([
                      ["base-3-4", "最多 4 人"],
                      ["extended-5-6", "最多 6 人"],
                    ] as const).map(([ruleProfile, label]) => (
                      <Button
                        key={ruleProfile}
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                          "h-7 rounded-md px-2.5 text-xs",
                          room.settings.ruleProfile === ruleProfile
                            ? "bg-[#37685d] text-white hover:bg-[#315d53] hover:text-white"
                            : "text-[#53665f] hover:bg-white/55",
                        )}
                        aria-pressed={room.settings.ruleProfile === ruleProfile}
                        disabled={!isHost || busy || (ruleProfile === "base-3-4" && room.members.length > 4)}
                        onClick={() => onSettingsChange({
                          ...settings,
                          ruleProfile,
                          victoryPointsToWin: room.settings.victoryPointsToWin,
                        })}
                      >
                        {label}
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
                      ...settings,
                      ruleProfile: room.settings.ruleProfile,
                      victoryPointsToWin: Number(event.target.value),
                    })}
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 5).map((score) => (
                      <option key={score} value={score}>{score} 分</option>
                    ))}
                  </select>
                </SettingRow>
                <SettingRow label="银行剩余数量">
                  <select
                    className="h-8 rounded-lg border border-[#695237]/20 bg-[#fffaf0]/80 px-2 text-sm font-bold text-[#29433d] focus-visible:ring-2 focus-visible:ring-[#37685d]/45 disabled:opacity-65"
                    aria-label="银行剩余数量"
                    value={room.settings.bankCountsPublic ? "public" : "hidden"}
                    disabled={!isHost || busy}
                    onChange={(event) => onSettingsChange({ ...settings, bankCountsPublic: event.target.value === "public" })}
                  >
                    <option value="public">公开</option>
                    <option value="hidden">不公开</option>
                  </select>
                </SettingRow>
              </div>
            </section>
          ) : null}

          {showPlayers ? <section aria-label="落座玩家">
            <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
              <span className="flex items-center gap-2"><Users className="size-4 text-[#b45c42]" />落座玩家</span>
              <span className="flex items-center gap-1.5">
                {room.game === null && isHost ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] tracking-normal text-[#49615a] hover:bg-white/55"
                    aria-label="随机打乱玩家顺序"
                    disabled={busy || room.members.length < 2}
                    onClick={onShufflePlayers}
                  >
                    <Shuffle className="size-3" />乱序
                  </Button>
                ) : null}
                <span>{room.members.length}/{room.settings.playerLimit}</span>
              </span>
            </div>
            <div className="space-y-1">
              {room.members.map((member, memberIndex) => {
                const gamePlayer = room.game?.players.find((player) => player.id === member.id);
                return (
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2",
                    member.id === playerId ? "bg-white/55 ring-1 ring-[#5b7f73]/20" : "bg-transparent",
                  )} key={member.id} data-player-id={member.id} data-player-target={member.id} data-current-player={member.id === playerId ? "true" : undefined}>
                    {room.game === null && member.id === playerId ? (
                      <PlayerColorPicker
                        currentColor={member.color}
                        members={room.members}
                        busy={busy}
                        onChange={onPlayerColorChange}
                      />
                    ) : (
                      <PlayerSettlementIcon color={member.color} className="size-8" label={`${member.name}的村庄颜色`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <strong className="truncate text-sm text-[#263d39]">{member.name}</strong>
                        {member.isHost ? <Crown className="size-3.5 text-[#ba8131]" aria-label="房主" /> : null}
                      </div>
                      <span className="text-[11px] text-[#757b73]">第 {memberIndex + 1} 位 · {member.id === playerId ? "你" : "玩家"}</span>
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
          </section> : null}

          {room.game === null ? (
            <div className="mt-auto rounded-xl border border-[#695237]/15 bg-white/35 p-3 text-center text-sm text-[#6e746d]">
              {isHost ? (
                <>
                  <Button className="w-full" disabled={!canStart || busy} onClick={onStart}>
                    {room.members.length < minimumPlayers ? `等待至少 ${minimumPlayers} 人` : busy ? "正在开局…" : "使用当前地图开局"}
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
          <CardFooter className="flex-col gap-1 border-t border-[#5f4b31]/15 px-5 py-3">
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
            {isHost ? <DisbandRoomControl room={room} busy={busy} onDisband={onDisband} /> : null}
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
