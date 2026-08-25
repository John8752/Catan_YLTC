import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "@catan/game-core";
import { SelectedResourceCards, ResourceCardPalette } from "./ResourceCardPicker.js";
import { resourceLabel, resourceMark } from "./ResourceCard.js";

export const TRADE_RESOURCES = RESOURCE_TYPES;
export type TradeResource = ResourceType;
export type TradeBasket = ResourceHand;

export interface TradeResourceBasketProps {
  readonly label: string;
  readonly value: TradeBasket;
  readonly maximums?: TradeBasket | undefined;
  readonly showPalette?: boolean;
  readonly onChange: (value: TradeBasket) => void;
}

export function TradeResourceBasket({ label, value, maximums, showPalette = true, onChange }: TradeResourceBasketProps) {
  return (
    <div className="grid gap-2.5" role="group" aria-label={label} data-trade-resource-basket={label}>
      {showPalette ? (
        <ResourceCardPalette
          label={label}
          value={value}
          maximums={maximums}
          counts={maximums}
          compact
          onChange={onChange}
        />
      ) : null}
      <SelectedResourceCards label={label} value={value} onChange={onChange} />
      <small className="text-center font-bold text-[#7a7062]">合计 {tradeBasketTotal(value)} 张</small>
    </div>
  );
}

export function TradeResourceSummary({ resources }: { readonly resources: TradeBasket }) {
  return <SelectedResourceCards label="资源明细" value={resources} emptyLabel="0 张资源" />;
}

export function emptyTradeBasket(): TradeBasket {
  return emptyResourceHand();
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

export { resourceLabel, resourceMark };
