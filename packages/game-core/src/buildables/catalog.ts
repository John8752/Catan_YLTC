import { resourceAmounts, type ResourceHand } from "../resources/index.js";

export const BUILD_COSTS: Readonly<Record<"road" | "settlement" | "city" | "development", ResourceHand>> = {
  road: resourceAmounts({ brick: 1, lumber: 1 }),
  settlement: resourceAmounts({ brick: 1, lumber: 1, wool: 1, grain: 1 }),
  city: resourceAmounts({ grain: 2, ore: 3 }),
  development: resourceAmounts({ wool: 1, grain: 1, ore: 1 }),
};
