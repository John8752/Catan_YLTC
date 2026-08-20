export const RESOURCE_TYPES = ["brick", "lumber", "wool", "grain", "ore"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type ResourceHand = Record<ResourceType, number>;

export function emptyResourceHand(): ResourceHand {
  return {
    brick: 0,
    lumber: 0,
    wool: 0,
    grain: 0,
    ore: 0,
  };
}

export function initialResourceBank(): ResourceHand {
  return createResourceBank(19);
}

export function createResourceBank(cardsPerResource: number): ResourceHand {
  return {
    brick: cardsPerResource,
    lumber: cardsPerResource,
    wool: cardsPerResource,
    grain: cardsPerResource,
    ore: cardsPerResource,
  };
}

export function resourceCardCount(hand: ResourceHand): number {
  return RESOURCE_TYPES.reduce((total, resource) => total + hand[resource], 0);
}
