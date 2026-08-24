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
    <div className="grid gap-2.5" role="group" aria-label={label} data-trade-resource-basket={label}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {TRADE_RESOURCES.map((resource) => {
          const maximum = maximums?.[resource];
          return (
            <label className="grid min-w-0 gap-2 rounded-xl border border-[#6d5434]/12 bg-[#fffaf0]/75 p-2 shadow-[inset_0_1px_rgba(255,255,255,.7)]" key={resource}>
              <span className="flex items-center gap-1.5 text-xs font-black text-[#4f5d58]" title={resourceLabel(resource)}>
                <span className={`grid size-6 place-items-center rounded-full text-xs text-white ${resourceTokenClass(resource)}`} aria-hidden="true">
                  {resourceMark(resource)}
                </span>
                {resourceLabel(resource)}
              </span>
              <input
                className="h-9 w-full min-w-0 rounded-lg border border-input bg-white/85 px-1 text-center text-base font-black text-[#263d39] outline-none focus:border-[#2f6f7a] focus:ring-2 focus:ring-[#2f6f7a]/20"
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
      <small className="text-center font-bold text-[#7a7062]">合计 {tradeBasketTotal(value)} 张</small>
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
        <Badge className={`gap-1 border-0 px-3 py-1.5 text-sm text-white shadow-sm ${resourceTokenClass(resource)}`} key={resource}>
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

function resourceTokenClass(resource: TradeResource): string {
  return {
    brick: "bg-[#a9523f]",
    lumber: "bg-[#34704a]",
    wool: "bg-[#78945f]",
    grain: "bg-[#c3942d]",
    ore: "bg-[#617278]",
  }[resource];
}

function clampAmount(rawValue: string, maximum: number): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(maximum, Math.floor(parsed)));
}
