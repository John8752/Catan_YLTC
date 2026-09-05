import type { AccountRecord, AccountRepository, SessionRecord } from "../auth/account-repository.js";
import type { SqliteDatabase } from "./sqlite-database.js";

export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly database: SqliteDatabase) {}
  private get db() { return this.database.db; }
  findUsername(username: string): AccountRecord | null { return this.account("username_key", username); }
  findId(id: string): AccountRecord | null { return this.account("id", id); }
  private account(column: "id" | "username_key", value: string): AccountRecord | null {
    return (this.db.prepare(`SELECT id, username_key AS username, display_name AS displayName,
      password_hash AS passwordHash, status FROM accounts WHERE ${column}=?`).get(value) as unknown as AccountRecord) ?? null;
  }
  insert(account: AccountRecord, now: number): void {
    this.db.prepare("INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?)").run(account.id, account.username,
      account.displayName, account.passwordHash, account.status, now, now, now);
  }
  updateProfile(id: string, displayName: string, now: number): void {
    this.db.prepare("UPDATE accounts SET display_name=?, updated_at=? WHERE id=?").run(displayName, now, id);
  }
  updatePassword(id: string, hash: string, now: number): void {
    this.database.transaction(() => {
      this.db.prepare("UPDATE accounts SET password_hash=?, password_changed_at=?, updated_at=? WHERE id=?").run(hash, now, now, id);
      this.revokeSession(id);
    });
  }
  replaceSession(s: SessionRecord): void {
    this.database.transaction(() => {
      this.revokeSession(s.accountId);
      this.db.prepare("INSERT INTO account_sessions VALUES(?,?,?,?,?,?)").run(s.id, s.accountId, s.tokenHash, s.createdAt, s.lastSeenAt, s.expiresAt);
    });
  }
  findSession(id: string): SessionRecord | null {
    return (this.db.prepare(`SELECT id, account_id AS accountId, token_hash AS tokenHash, created_at AS createdAt,
      last_seen_at AS lastSeenAt, expires_at AS expiresAt FROM account_sessions WHERE id=?`).get(id) as unknown as SessionRecord) ?? null;
  }
  revokeSession(accountId: string): void { this.db.prepare("DELETE FROM account_sessions WHERE account_id=?").run(accountId); }
  hasLiveSession(accountId: string, now: number): boolean {
    return this.db.prepare("SELECT 1 FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE a.id=? AND a.status='active' AND s.expires_at>?").get(accountId, now) !== undefined;
  }
  invalidSessionAccounts(now: number): readonly string[] {
    return this.db.prepare("SELECT s.account_id FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.expires_at<=? OR a.status!='active'").all(now).map((row) => String(row.account_id));
  }
  touchSession(id: string, now: number): void { this.db.prepare("UPDATE account_sessions SET last_seen_at=? WHERE id=?").run(now, id); }
}
