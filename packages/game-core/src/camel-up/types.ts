export const RACING_CAMELS = ["blue", "green", "yellow", "red", "purple"] as const;
export const CRAZY_CAMELS = ["black", "white"] as const;
export const DICE = [...RACING_CAMELS, "grey"] as const;
export type RacingCamel = typeof RACING_CAMELS[number];
export type Camel = RacingCamel | typeof CRAZY_CAMELS[number];
export type Die = typeof DICE[number];
export type Face = 1 | 2 | 3;
export type BetKind = "winner" | "loser";
export interface CamelPlayer { id: string; name: string; coins: number; tickets: { camel: RacingCamel; value: number }[]; pyramidTickets: number; partnerId: string | null }
export interface FinishBet { playerId: string; camel: RacingCamel; kind: BetKind }
export interface SpectatorTile { playerId: string; space: number; side: "cheer" | "boo" }
export interface RollInput { die: Die; value: Face; crazy: "black" | "white" }
export interface CamelSetup { positions: readonly Face[]; order: readonly RacingCamel[]; crazyPositions: readonly [Face, Face] }
export type CamelAction = { type: "roll" } | { type: "ticket"; camel: RacingCamel } | { type: "tile"; space: number; side: "cheer" | "boo" } | { type: "finish-bet"; camel: RacingCamel; kind: BetKind } | { type: "partner"; playerId: string };
export type CamelCommand = CamelAction & { matchId: string; expectedRevision: number };
export interface LegResult { leg: number; ranking: RacingCamel[]; deltas: { playerId: string; delta: number; partnerBonus: number }[] }
/** Public action receipt. Secret finish-card colours never enter effects. */
export interface CamelEffect { revision: number; playerId: string; type: CamelAction["type"]; camel: Camel | null; space: number | null; value: Face | null; betKind: BetKind | null; legEnded: boolean; finished: boolean }
export interface CamelState {
  id: string; revision: number; leg: number;
  phase: { kind: "racing"; activePlayerId: string } | { kind: "finished"; winnerIds: string[] };
  players: CamelPlayer[];
  /** Index is the unwrapped track position. Each stack is bottom to top. */
  stacks: Record<number, Camel[]>;
  remainingDice: Die[]; rolls: RollInput[]; tiles: SpectatorTile[];
  finishBets: FinishBet[]; lastRoll: (RollInput & { camel: Camel; from: number; to: number }) | null;
  lastLeg: LegResult | null;
  effect: CamelEffect | null;
  /** Bounded public action text; hidden bet colours never enter it. */
  log: string[];
}
export class CamelError extends Error { constructor(readonly code: string, message: string) { super(message); this.name = "CamelError"; } }
