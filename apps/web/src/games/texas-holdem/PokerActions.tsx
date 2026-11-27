import { useEffect, useState } from "react";
import type { PokerAction, PokerView } from "@catan/protocol/texas-holdem";
import { Button } from "../../components/ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.js";
export function PokerActions({ game, busy, onAction }: { game: PokerView; busy: boolean; onAction: (a: PokerAction) => Promise<void> }) {
  const legal = game.legal, [amount, setAmount] = useState(legal.minRaiseTo ?? legal.maxRaiseTo), [open, setOpen] = useState(false);
  useEffect(() => { setAmount(legal.minRaiseTo ?? legal.maxRaiseTo); setOpen(false); }, [game.revision, legal.minRaiseTo, legal.maxRaiseTo]);
  const raise = legal.minRaiseTo !== null;
  return <section className="grid grid-cols-3 gap-2" aria-label="你的行动">
    <Button variant="ghost" className="min-h-12 rounded-full border border-[#72917d]/50 bg-[#17352a] text-[#d6e6da] hover:bg-[#294b3d] hover:text-white" disabled={busy || !legal.fold} onClick={() => void onAction({ type: "fold" })}>弃牌</Button>
    {legal.check ? <Button className="min-h-12 rounded-full bg-[#c5dfcc] font-semibold text-[#173c2c] hover:bg-[#e2eddf]" disabled={busy} onClick={() => void onAction({ type: "check" })}>过牌</Button>
      : <Button className="min-h-12 rounded-full bg-[#c5dfcc] font-semibold text-[#173c2c] hover:bg-[#e2eddf]" disabled={busy || legal.call === null} onClick={() => void onAction({ type: "call" })}>跟注 {legal.call ?? 0}</Button>}
    {!raise ? <Button className="min-h-12 rounded-full bg-[#d8b979] font-semibold text-[#322719] hover:bg-[#edcf94]" disabled={busy || !legal.allIn} onClick={() => void onAction({ type: "all-in" })}>全下</Button> : <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button className="min-h-12 rounded-full bg-[#d8b979] font-semibold text-[#322719] hover:bg-[#edcf94]" disabled={busy}>加注</Button></PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={12} className="w-[min(360px,calc(100vw-24px))] space-y-4 rounded-2xl border-[#698171] bg-[#102b23] p-4 text-[#edf1e4]">
        <h3 className="text-base font-semibold">加注到</h3>
        <div className="grid grid-cols-3 gap-2">{[{ text: "最小加注", value: legal.minRaiseTo! }, { text: "半个底池", value: Math.max(legal.minRaiseTo!, game.currentBet + Math.floor((game.pot + (legal.call ?? 0)) / 2)) }, { text: "一个底池", value: Math.max(legal.minRaiseTo!, game.currentBet + game.pot + (legal.call ?? 0)) }].map((p) => <Button key={p.text} variant="ghost" className="min-h-10 border border-[#577362] text-xs hover:bg-[#294b3d] hover:text-white" disabled={busy} onClick={() => setAmount(Math.min(legal.maxRaiseTo, p.value))}>{p.text}</Button>)}</div>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (raise) void onAction({ type: "raise", to: amount }); }}>
          <label className="flex items-center justify-between gap-4 text-sm">本轮下注总额<input type="number" inputMode="numeric" className="h-12 w-36 rounded-lg border border-[#78967d] bg-[#071e16] px-3 text-right text-lg tabular-nums text-white outline-none focus-visible:ring-2 focus-visible:ring-[#d8b979]" min={legal.minRaiseTo!} max={legal.maxRaiseTo} step={1} value={amount} disabled={busy} onChange={(e) => setAmount(Number(e.target.value))} aria-label="加注总额" /></label>
          <input type="range" aria-label="调整加注总额" min={legal.minRaiseTo!} max={legal.maxRaiseTo} step={1} value={Math.max(legal.minRaiseTo!, Math.min(legal.maxRaiseTo, amount))} className="h-8 w-full accent-[#d8b979]" onChange={(e) => setAmount(Number(e.target.value))} />
          <div className="grid grid-cols-2 gap-2"><Button type="button" variant="ghost" className="min-h-12 border border-[#bf9466] text-[#f1cf9a] hover:bg-[#50362a] hover:text-white" disabled={busy || !legal.allIn} onClick={() => void onAction({ type: "all-in" })}>全下</Button><Button type="submit" className="min-h-12 bg-[#d8b979] font-semibold text-[#322719] hover:bg-[#edcf94]" disabled={busy || amount < legal.minRaiseTo! || amount > legal.maxRaiseTo}>确认加注</Button></div>
        </form>
        <p className="text-xs text-[#adc3b0]">最小 {legal.minRaiseTo} · 最大 {legal.maxRaiseTo}，输入为本轮累计总额。</p>
      </PopoverContent>
    </Popover>}
  </section>;
}
