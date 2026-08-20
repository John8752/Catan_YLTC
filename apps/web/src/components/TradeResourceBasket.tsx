import { Badge } from "@/components/ui/badge.js";

export const TRADE_RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
export type TradeResource = (typeof TRADE_RESOURCES)[number];
export type TradeBasket = Record<TradeResource, number>;

export interface TradeResourceBasketProps {
  readonly label: string;
  readonly value: TradeBasket;
  readonly maximums?: TradeBasket;
  readonly onChange: (value: TradeBasket) => void;
}

export function TradeResourceBasket({ label, value, maximums, onChange }: TradeResourceBasketProps) {
  return (
    <div className="grid gap-2" role="group" aria-label={label} data-trade-resource-basket={label}>
      <div className="grid grid-cols-5 gap-1.5">
        {TRADE_RESOURCES.map((resource) => {
          const maximum = maximums?.[resource];
          return (
            <label className="grid min-w-0 gap-1 rounded-lg border border-[#6d5434]/12 bg-[#fffaf0]/65 p-1.5" key={resource}>
              <span className="truncate text-[11px] font-bold text-[#5f665f]" title={resourceLabel(resource)}>
                <span aria-hidden="true">{resourceMark(resource)}</span> {resourceLabel(resource)}
              </span>
              <input
                className="w-full min-w-0 rounded-md border border-input bg-white/80 px-1 py-1.5 text-center font-black outline-none focus:ring-2 focus:ring-ring"
                type="number"
                min="0"
                max={maximum}
                step="1"
                value={value[resource]}
                aria-label={`${label}：${resourceLabel(resource)}数量`}
                onChange={(event) => onChange({
                  ...value,
                  [resource]: clampAmount(event.target.value, maximum ?? Number.MAX_SAFE_INTEGER),
                })}
              />
            </label>
          );
        })}
      </div>
      <small className="text-center text-[#7a7062]">合计 {tradeBasketTotal(value)} 张</small>
    </div>
  );
}

export function TradeResourceSummary({ resources }: { readonly resources: TradeBasket }) {
  const selectedResources = TRADE_RESOURCES.filter((resource) => resources[resource] > 0);
  if (selectedResources.length === 0) {
    return (
      <div className="flex min-h-12 items-center justify-center">
        <Badge variant="outline" className="border-dashed border-[#6d5434]/30 bg-white/40 px-3 py-1.5 text-[#766d60]">
          0 张资源
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex min-h-12 flex-wrap items-center justify-center gap-2">
      {selectedResources.map((resource) => (
        <Badge className="gap-1 bg-[#254f4b] px-3 py-1.5 text-sm text-[#fff8df]" key={resource}>
          <span aria-hidden="true">{resourceMark(resource)}</span>{resources[resource]} {resourceLabel(resource)}
        </Badge>
      ))}
    </div>
  );
}

export function emptyTradeBasket(): TradeBasket {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}

export function tradeBasketTotal(basket: TradeBasket): number {
  return TRADE_RESOURCES.reduce((total, resource) => total + basket[resource], 0);
}

export function hasTradeResources(hand: TradeBasket, cost: TradeBasket): boolean {
  return TRADE_RESOURCES.every((resource) => hand[resource] >= cost[resource]);
}

export function overlappingTradeResources(first: TradeBasket, second: TradeBasket): readonly TradeResource[] {
  return TRADE_RESOURCES.filter((resource) => first[resource] > 0 && second[resource] > 0);
}

export function resourceLabel(resource: TradeResource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}

export function resourceMark(resource: TradeResource): string {
  return { brick: "▧", lumber: "♠", wool: "⌁", grain: "≋", ore: "◆" }[resource];
}

function clampAmount(rawValue: string, maximum: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(parsed)));
}
