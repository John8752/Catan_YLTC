import type { TurnTimerView } from "@catan/protocol";
import { AlarmClock } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils.js";

export function TurnTimerBadge({
  timer,
  className,
}: {
  readonly timer: TurnTimerView;
  readonly className?: string;
}) {
  const remainingMs = useServerCountdown(timer);
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const urgent = remainingSeconds <= (timer.kind === "roll" ? 3 : 10);
  const label = timer.kind === "roll" ? "掷骰倒计时" : "操作倒计时";

  return (
    <span
      className={cn(
        "turn-timer-badge inline-flex shrink-0 items-center justify-center gap-0.5 rounded-full border px-1 py-0.5 font-mono text-[9px] leading-none font-black tabular-nums shadow-sm lg:gap-1 lg:px-1.5 lg:text-[11px]",
        urgent
          ? "border-[#ffbd8f]/75 bg-[#9d3f31] text-white"
          : "border-[#f4d887]/65 bg-[#173f3b] text-[#ffe69c]",
        className,
      )}
      role="timer"
      aria-label={`${label}，剩余 ${accessibleTime(remainingSeconds)}`}
      data-turn-timer-player={timer.playerId}
      data-turn-timer-kind={timer.kind}
      title={label}
    >
      <AlarmClock className="size-2.5 lg:size-3" aria-hidden="true" />
      <span>{formatTime(remainingSeconds)}</span>
    </span>
  );
}

function useServerCountdown(timer: TurnTimerView): number {
  const initialRemaining = () => Math.max(0, timer.deadlineAt - timer.serverNow);
  const [remainingMs, setRemainingMs] = useState(initialRemaining);

  useEffect(() => {
    const receivedAt = Date.now();
    const remainingAtReceipt = initialRemaining();
    const update = () => {
      setRemainingMs(Math.max(0, remainingAtReceipt - (Date.now() - receivedAt)));
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timer.deadlineAt, timer.serverNow]);

  return remainingMs;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function accessibleTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}
