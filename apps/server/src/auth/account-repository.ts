import type { AccountView } from "@catan/protocol";
export interface AccountRecord extends AccountView {
  readonly passwordHash: string;
  readonly status: "active" | "disabled";
}
export interface SessionRecord {
  readonly id: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly createdAt: number;
  readonly lastSeenAt: number;
  readonly expiresAt: number;
}
export interface AccountRepository {
  findUsername(username: string): AccountRecord | null;
  findId(id: string): AccountRecord | null;
  insert(account: AccountRecord, now: number): void;
  updateProfile(id: string, displayName: string, now: number): void;
  updatePassword(id: string, hash: string, now: number): void;
  replaceSession(session: SessionRecord): void;
  findSession(id: string): SessionRecord | null;
  hasLiveSession(accountId: string, now: number): boolean;
  invalidSessionAccounts(now: number): readonly string[];
  revokeSession(accountId: string): void;
  touchSession(id: string, now: number): void;
}
