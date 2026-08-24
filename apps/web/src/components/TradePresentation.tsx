import { ArrowDown, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button.js";
import { Card } from "@/components/ui/card.js";
import {
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.js";
import { cn } from "@/lib/utils.js";
import {
  hasTradeResources,
  overlappingTradeResources,
  resourceLabel,
  tradeBasketTotal,
  type TradeBasket,
} from "./TradeResourceBasket.js";

export function TradeDialogHeader({
  icon,
  eyebrow,
  title,
  description,
  onClose,
}: {
  readonly icon: React.ReactNode;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly onClose?: () => void;
}) {
  return (
    <DialogHeader className="sticky top-0 z-20 overflow-hidden border-b border-[#6d5434]/12 bg-[linear-gradient(120deg,rgba(31,73,68,.99),rgba(44,92,83,.98))] p-5 pr-16 text-left text-[#fff8df] shadow-md sm:p-6 sm:pr-16">
      <div className="absolute -top-12 -right-8 size-40 rounded-full border border-white/10 bg-white/5" aria-hidden="true" />
      <p className="relative mb-0 text-[11px] font-black tracking-[.18em] text-[#efc887] uppercase">{eyebrow}</p>
      <DialogTitle className="relative flex items-center gap-3 font-serif text-2xl sm:text-3xl">
        <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#efc887]">{icon}</span>
        {title}
      </DialogTitle>
      <DialogDescription className="relative max-w-xl text-[#fff8df]/72">{description}</DialogDescription>
      {onClose === undefined ? null : (
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-[#fff8df] hover:bg-white/10 hover:text-white" aria-label="暂时关闭交易弹窗" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </DialogClose>
      )}
    </DialogHeader>
  );
}

export function TradeExchange({
  giveLabel,
  receiveLabel,
  give,
  receive,
}: {
  readonly giveLabel: string;
  readonly receiveLabel: string;
  readonly give: React.ReactNode;
  readonly receive: React.ReactNode;
}) {
  return (
    <div className="grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4">
      <Card className="gap-3 border-[#8c5d47]/15 bg-[#fffaf0]/72 p-3 text-center shadow-sm sm:p-4">
        <small className="font-black tracking-[.08em] text-[#8e5d48] uppercase">{giveLabel}</small>
        {give}
      </Card>
      <span className="grid place-items-center" aria-hidden="true">
        <span className="grid size-9 place-items-center rounded-full border border-[#a65c43]/20 bg-[#ead2aa] text-[#9c573f] shadow-inner">
          <ArrowDown className="size-5 sm:rotate-[-90deg]" />
        </span>
      </span>
      <Card className="gap-3 border-[#315f59]/15 bg-[#eef0db]/72 p-3 text-center shadow-sm sm:p-4">
        <small className="font-black tracking-[.08em] text-[#35645d] uppercase">{receiveLabel}</small>
        {receive}
      </Card>
    </div>
  );
}

export function TradeValidationNote({ problem, fallback }: { readonly problem: string | null; readonly fallback: string }) {
  return (
    <p className={cn("m-0 flex items-center justify-center gap-2 text-center text-xs", problem === null ? "text-[#68736d]" : "font-bold text-rose-700")}>
      {problem === null ? <ShieldCheck className="size-4 text-[#367260]" /> : <X className="size-4" />}
      {problem ?? fallback}
    </p>
  );
}

export function tradeProblem(
  proposerGives: TradeBasket,
  proposerReceives: TradeBasket,
  proposerMaximums?: TradeBasket,
  responderMaximums?: TradeBasket,
): string | null {
  if (tradeBasketTotal(proposerGives) === 0 && tradeBasketTotal(proposerReceives) === 0) return "报价双方不能同时为空";
  const overlaps = overlappingTradeResources(proposerGives, proposerReceives);
  if (overlaps.length > 0) return `同一种资源不能同时出现在两侧：${overlaps.map(resourceLabel).join("、")}`;
  if (proposerMaximums !== undefined && !hasTradeResources(proposerMaximums, proposerGives)) return "你提供的资源超过了当前持有数量";
  if (responderMaximums !== undefined && !hasTradeResources(responderMaximums, proposerReceives)) return "你愿意交出的资源超过了当前持有数量";
  return null;
}
