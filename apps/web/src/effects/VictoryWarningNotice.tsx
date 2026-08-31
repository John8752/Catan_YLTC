import { victoryWarningMessage, type VictoryWarningEffectView } from "@catan/protocol";
import { Trophy } from "lucide-react";

export function VictoryWarningNotice({ notice }: { readonly notice: VictoryWarningEffectView }) {
  return (
    <span
      data-victory-notice={notice.id}
      className="flex max-w-full min-w-0 items-center gap-1 rounded-full border border-[#c08a29] bg-[#fff0c2] px-2 text-xs leading-5 font-bold text-[#70450c] lg:gap-1.5 lg:px-3 lg:text-sm"
      aria-label={victoryWarningMessage(notice)}
      title={victoryWarningMessage(notice)}
    >
      <Trophy className="size-3 shrink-0 lg:size-3.5" aria-hidden="true" />
      <span className="truncate">{notice.playerName}</span>
      <span className="shrink-0 tabular-nums">· {notice.publicPoints}/{notice.targetPoints} · {notice.publicPoints >= notice.targetPoints ? "公开分已达目标" : "接近获胜"}</span>
    </span>
  );
}
