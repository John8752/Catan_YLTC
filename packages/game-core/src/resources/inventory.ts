import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "./types.js";

export function hasResources(hand: ResourceHand, cost: ResourceHand): boolean {
  return RESOURCE_TYPES.every((resource) => hand[resource] >= cost[resource]);
}

export function addResourceHands(first: ResourceHand, second: ResourceHand): ResourceHand {
  return mapResources((resource) => first[resource] + second[resource]);
}

export function subtractResourceHands(first: ResourceHand, second: ResourceHand): ResourceHand {
  return mapResources((resource) => first[resource] - second[resource]);
}

export function totalResources(hand: ResourceHand): number {
  return RESOURCE_TYPES.reduce((total, resource) => total + hand[resource], 0);
}

export function resourceAmounts(values: Partial<ResourceHand>): ResourceHand {
  return { ...emptyResourceHand(), ...values };
}

function mapResources(value: (resource: ResourceType) => number): ResourceHand {
  return Object.fromEntries(RESOURCE_TYPES.map((resource) => [resource, value(resource)])) as ResourceHand;
}
