export const PLAYABLE_RULE_PROFILES = ["base-3-4", "extended-5-6", "large-5-6"] as const;
export type RuleProfile = (typeof PLAYABLE_RULE_PROFILES)[number] | "two-player";

export const DEFAULT_VICTORY_POINTS_TO_WIN = 10;
export const MIN_VICTORY_POINTS_TO_WIN = 5;
export const MAX_VICTORY_POINTS_TO_WIN = 15;
