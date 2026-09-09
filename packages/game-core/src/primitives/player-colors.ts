/** Shared seat palette; colors carry no game rules. */
export const PLAYER_COLORS = ["terracotta", "ocean", "pine", "wheat", "plum", "charcoal", "coral", "orange", "navy", "emerald", "lavender", "graphite"] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];
