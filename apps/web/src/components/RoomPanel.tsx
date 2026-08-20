import type { RoomView } from "@catan/protocol";
import { Activity, Crown, LogOut, Route, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card.js";
import { ScrollArea } from "@/components/ui/scroll-area.js";
import { Separator } from "@/components/ui/separator.js";
import { cn } from "@/lib/utils.js";

export interface RoomPanelProps {
  readonly room: RoomView;
  readonly playerId: string;
  readonly connectionState: "connecting" | "live" | "offline";
  readonly busy: boolean;
  readonly onStart: () => void;
  readonly onLeave: () => void;
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

        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
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

          <section aria-label="落座玩家">
            <div className="mb-2 flex items-center justify-between text-xs font-black tracking-[.12em] text-[#5d665f] uppercase">
              <span className="flex items-center gap-2"><Users className="size-4 text-[#b45c42]" />落座玩家</span>
              <span>{room.members.length}/4</span>
            </div>
            <div className="space-y-1">
              {room.members.map((member) => {
                const gamePlayer = room.game?.players.find((player) => player.id === member.id);
                return (
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl px-2.5 py-2.5",
                    member.id === playerId ? "bg-white/55 ring-1 ring-[#5b7f73]/20" : "bg-transparent",
                  )} key={member.id} data-player-id={member.id} data-current-player={member.id === playerId ? "true" : undefined}>
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
                    {room.members.length < 3 ? "等待至少 3 人" : busy ? "正在开局…" : "生成岛屿并开局"}
                  </Button>
                  <p className="mt-2 mb-0 text-xs">支持 3–4 人基础规则完整对局。</p>
                </>
              ) : <p className="mb-0">等待房主开局。把房间码发给朋友即可加入。</p>}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="border-t border-[#5f4b31]/15 px-5 py-3">
          <Button variant="ghost" className="w-full text-[#3f5b55] hover:bg-white/45" onClick={onLeave}>
            <LogOut className="size-4" />离开当前标签页会话
          </Button>
        </CardFooter>
      </Card>
    </aside>
  );
}
