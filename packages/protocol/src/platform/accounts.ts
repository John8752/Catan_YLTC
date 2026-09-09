import type { RoomSession } from "./index.js";

export interface AccountView {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
}
export interface AuthResponse {
  readonly account: AccountView;
  readonly csrfToken: string;
  readonly activeSeat: RoomSession | null;
}
export interface LoginRequest {
  readonly username: string;
  readonly password: string;
  readonly guestSeat?: { readonly roomId: string; readonly seatToken: string } | undefined;
}
export interface RegisterRequest extends LoginRequest { readonly displayName: string }
export interface UpdateProfileRequest { readonly displayName: string }
export interface ChangePasswordRequest { readonly currentPassword: string; readonly newPassword: string }
export type AccountErrorCode = "AUTH_REQUIRED" | "INVALID_CREDENTIALS" | "USERNAME_TAKEN" | "CSRF_REJECTED" | "AUTH_BUSY";

/** Only final, player-safe results. No replay, map, hands or credentials. */
export interface MatchRecord<Data = unknown> {
  readonly gameId: string;
  readonly matchId: string;
  readonly dataVersion: number;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly data: Data;
}
export interface AccountMatchRecord extends MatchRecord { readonly playerId: string }
export interface MatchHistoryResponse {
  readonly matches: readonly AccountMatchRecord[];
  readonly nextOffset: number | null;
}
