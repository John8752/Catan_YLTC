import { Minus } from "lucide-react";
import { Button } from "./ui/button.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import { TRADE_RESOURCES, type TradeBasket, tradeBasketTotal } from "./TradeResourceBasket.js";

/** One selected quantity per resource; no second pile of selected cards. */
export function TradeAmountRow({ label, value, maximums, onChange }: {
  readonly label: string;
  readonly value: TradeBasket;
  readonly maximums?: TradeBasket;
  readonly onChange: (value: TradeBasket) => void;
}) {
  return <div role="group" aria-label={label} data-trade-amount-row={label} className="grid grid-cols-5 gap-1.5">
    {TRADE_RESOURCES.map((resource) => <div key={resource} className="grid min-w-0 gap-1">
      <ResourceCard resource={resource} variant="compact" count={value[resource]} pressed={value[resource] > 0}
        className="h-12 w-full [&_[data-resource-count]]:text-base"
        ariaLabel={`在${label}中加入 1 张${resourceLabel(resource)}，已选 ${value[resource]} 张${maximums ? `，持有 ${maximums[resource]} 张` : ""}`}
        disabled={maximums !== undefined && value[resource] >= maximums[resource]}
        onClick={() => onChange({ ...value, [resource]: value[resource] + 1 })} />
      <Button type="button" variant="ghost" className="h-11 min-w-0 gap-0.5 px-0 text-xs text-[#52675e]"
        aria-label={`从${label}中撤回 1 张${resourceLabel(resource)}`} disabled={value[resource] === 0}
        onClick={() => onChange({ ...value, [resource]: Math.max(0, value[resource] - 1) })}><Minus className="size-3" />1</Button>
    </div>)}
  </div>;
}

export function TradeOfferSummary({ give, receive }: { readonly give: TradeBasket; readonly receive: TradeBasket }) {
  const describe = (basket: TradeBasket) => tradeBasketTotal(basket) === 0 ? "无资源" : TRADE_RESOURCES
    .filter((r) => basket[r] > 0).map((r) => `${basket[r]}${resourceLabel(r)}`).join("、");
  return <p data-trade-offer-summary className="m-0 rounded-lg bg-white/55 px-2 py-1.5 text-xs leading-5 text-[#294b43]">
    <strong>我出</strong> {describe(give)}<span className="mx-2" aria-hidden="true">→</span><strong>我收</strong> {describe(receive)}
  </p>;
}
