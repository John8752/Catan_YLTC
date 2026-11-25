import type { Card } from "@catan/protocol/texas-holdem";
import { cn } from "../../lib/utils.js";
const suitNames = { S: "黑桃", H: "红桃", D: "方块", C: "梅花" } as const;
const rankNames: Record<string, string> = { T: "10", J: "J", Q: "Q", K: "K", A: "A" };
export function cardName(card: Card) { return `${suitNames[card[1] as keyof typeof suitNames]} ${rankNames[card[0]!] ?? card[0]}`; }
function Suit({ suit, className }: { suit: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {suit === "H" ? <path d="M12 22 2.6 12.2C-3 5.8 5.4-1 12 5.5 18.6-1 27 5.8 21.4 12.2Z" />
      : suit === "D" ? <path d="m12 1 10 11-10 11L2 12Z" />
      : suit === "S" ? <path d="M12 1 2.7 11c-5 6 2.5 12 7.5 6.5L8 23h8l-2.2-5.5C18.8 23 26.3 17 21.3 11Z" />
      : <path d="M12 1a5 5 0 0 1 4.2 7.8A5.6 5.6 0 1 1 14 18l2 5H8l2-5a5.6 5.6 0 1 1-2.2-9.2A5 5 0 0 1 12 1Z" />}
  </svg>;
}
export function PlayingCard({ card, size = "normal", highlighted = false }: { card: Card | null; size?: "small" | "normal" | "large" | "table"; highlighted?: boolean }) {
  const small = size === "small", rank = card ? rankNames[card[0]!] ?? card[0] : "", suit = card?.[1] ?? "";
  return <span role="img" aria-label={card ? cardName(card) : "未公开的底牌"} data-card={card ?? "back"}
    className={cn("poker-card relative inline-flex shrink-0 select-none flex-col items-center justify-center overflow-hidden rounded-[3px] border font-sans font-extrabold tabular-nums", small ? "h-[42px] w-[28px] gap-0.5" : size === "large" ? "h-[84px] w-[60px] gap-1" : size === "table" ? "poker-community-card gap-0.5" : "h-[76px] w-[50px] gap-1", card ? "border-[#c8c9c5] bg-white shadow-[0_1px_2px_#0003]" : "border-[#a7baaf] bg-[#163c34]", card && (suit === "H" || suit === "D") ? "text-[#dc2337]" : "text-[#111815]", highlighted && "outline-2 outline-offset-2 outline-[#e7bf6d]")}>
    {card ? <>
      <span className={cn("leading-none", small ? "text-[17px]" : size === "large" ? "text-[34px]" : "text-[26px]")}>{rank}</span>
      <Suit suit={suit} className={small ? "size-3.5" : size === "large" ? "size-8" : "size-6"} />
    </> : <span className="absolute inset-1 flex items-center justify-center rounded-sm border border-[#d3bd87]/70"><svg viewBox="0 0 32 48" className={small ? "w-3" : "w-6"} fill="none" stroke="#e0c994" strokeWidth="2" aria-hidden="true"><path d="m16 4 12 20-12 20L4 24Z" /><path d="m16 15 5 9-5 9-5-9Z" /></svg></span>}
  </span>;
}
