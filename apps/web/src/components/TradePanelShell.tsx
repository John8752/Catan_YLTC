import type { ReactNode } from "react";
import { ChevronDown, Handshake } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.js";

export function TradePanelShell({ compact, label, title, summary, badge, children }: {
  readonly compact: boolean; readonly label: string; readonly title: string;
  readonly summary: string; readonly badge: ReactNode; readonly children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(!compact);
  const trigger = <button type="button" data-trade-details-trigger={compact || undefined} aria-label={compact ? `展开交易详情，${summary}` : `${title} ${label}`} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[#294b47] hover:bg-white/35">
    <Handshake className="size-4 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1"><small className="block text-[10px] font-bold text-[#99543d]">{title}</small><strong className="block truncate text-xs">{compact ? summary : label}</strong></span>
    {badge}<ChevronDown className={cn("size-4 shrink-0", expanded && "rotate-180")} />
  </button>;
  if (compact) return <section id="active-trade-panel" className="col-span-2 min-w-0 rounded-xl border border-[#8d5b3f]/20 bg-[#fff8e8]" aria-label={label}>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden bg-[#fff8e8] p-0 text-[#294b47] sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-[#6d5434]/15 p-4 pr-12"><DialogTitle>{label}</DialogTitle><DialogDescription>{summary}</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3" data-trade-details="true">{children}</div>
      </DialogContent>
    </Dialog>
  </section>;
  return <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
    <section id="active-trade-panel" className="overflow-hidden rounded-2xl border border-[#8d5b3f]/20 bg-[#fff8e8]/96 shadow-[0_8px_20px_rgba(65,45,28,.24)] backdrop-blur-sm" aria-label={label}>
      <CollapsibleTrigger asChild>{trigger}</CollapsibleTrigger>
      <CollapsibleContent className="border-t border-[#6d5434]/12 px-3 py-3">{children}</CollapsibleContent>
    </section>
  </Collapsible>;
}
