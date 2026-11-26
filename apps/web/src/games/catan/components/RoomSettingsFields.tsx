import type { ReactNode } from "react";
import type { RoomSettingsInput, RoomView } from "@catan/protocol/catan";
import { getRuleProfileDefinition } from "@catan/game-core/catan";
import { Settings2, Trophy } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { cn } from "../../../lib/utils.js";
export function RoomSettingsFields({ room, isHost, busy, onSettingsChange }: { room: RoomView; isHost: boolean; busy: boolean; onSettingsChange: (settings: RoomSettingsInput) => void }) {
  const profile = getRuleProfileDefinition(room.settings.ruleProfile);
  const settings: RoomSettingsInput = { ruleProfile: room.settings.ruleProfile, victoryPointsToWin: room.settings.victoryPointsToWin, bankCountsPublic: room.settings.bankCountsPublic };
  return (<section aria-label="房间设置">
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
                          profile.maxPlayers === (ruleProfile === "base-3-4" ? 4 : 6)
                            ? "bg-[#37685d] text-white hover:bg-[#315d53] hover:text-white"
                            : "text-[#53665f] hover:bg-white/55",
                        )}
                        aria-pressed={profile.maxPlayers === (ruleProfile === "base-3-4" ? 4 : 6)}
                        disabled={!isHost || busy || (ruleProfile === "base-3-4" && room.members.length > 4)}
                        onClick={() => onSettingsChange({
                          ...settings,
                          ruleProfile: ruleProfile === "extended-5-6" && profile.maxPlayers === 6 ? settings.ruleProfile : ruleProfile,
                          victoryPointsToWin: room.settings.victoryPointsToWin,
                        })}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </SettingRow>
                {profile.maxPlayers === 6 ? (
                  <SettingRow label="地图大小">
                    <select
                      className="h-8 rounded-lg border border-[#695237]/20 bg-[#fffaf0]/80 px-2 text-sm font-bold text-[#29433d] focus-visible:ring-2 focus-visible:ring-[#37685d]/45 disabled:opacity-65"
                      aria-label="地图大小"
                      value={room.settings.ruleProfile}
                      disabled={!isHost || busy}
                      onChange={(event) => onSettingsChange({
                        ...settings,
                        ruleProfile: event.target.value === "large-5-6" ? "large-5-6" : "extended-5-6",
                      })}
                    >
                      <option value="extended-5-6">标准 · 30 块</option>
                      <option value="large-5-6">大地图 · 37 块</option>
                    </select>
                  </SettingRow>
                ) : null}
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
            </section>);
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
