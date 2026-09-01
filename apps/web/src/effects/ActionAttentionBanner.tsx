import type { ActionAttentionEffectView, VictoryWarningEffectView } from "@catan/protocol";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils.js";
import { VictoryWarningNotice } from "./VictoryWarningNotice.js";

export function ActionAttentionBanner({ notice, victoryNotice = null, fallback = null }: { readonly notice: ActionAttentionEffectView | null; readonly victoryNotice?: VictoryWarningEffectView | null; readonly fallback?: ReactNode }) {
  const banner = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (notice === null || notice.tone === "trade" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = banner.current?.animate?.([
      { filter: "brightness(1)", boxShadow: "0 0 0 transparent" },
      { filter: "brightness(1.15)", boxShadow: "0 0 14px #e49c9688", offset: 0.45 },
      { filter: "brightness(1)", boxShadow: "0 0 0 transparent" },
    ], { duration: 650, iterations: 1 });
    return () => animation?.cancel();
  }, [notice?.id]);

  return (
    <div className="pointer-events-none relative z-20 flex h-6 shrink-0 items-center justify-center" data-attention-slot="true" role="status" aria-live="polite" aria-atomic="true">
      {notice === null ? (victoryNotice === null ? fallback : <VictoryWarningNotice notice={victoryNotice} />) : (
        <span ref={banner} data-action-notice={notice.id} className={cn(
          "max-w-full rounded-full border px-3 text-xs leading-5 font-black lg:text-sm",
          notice.tone === "required" ? "border-[#e49c96] bg-[#fce5e3] text-[#8c3f3a]" : "border-[#a9c7c0]/60 bg-[#e3eee8] text-[#345951]",
        )}>{notice.notice}</span>
      )}
    </div>
  );
}
