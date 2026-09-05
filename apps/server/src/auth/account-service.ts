import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AccountView, AuthResponse, LoginRequest, RegisterRequest } from "@catan/protocol";
import type { RoomRegistry } from "../rooms.js";
import type { AccountRecord, AccountRepository, SessionRecord } from "./account-repository.js";
import { AuthError, hashPassword, passwordNeedsUpgrade, verifyPassword } from "./password.js";

export interface AuthContext { readonly account: AccountRecord; readonly session: SessionRecord; readonly csrfToken: string }
export class AccountService {
  constructor(readonly repository: AccountRepository, private readonly rooms: RoomRegistry,
    private readonly lifetimeMs = 30 * 24 * 60 * 60 * 1000, private readonly now = Date.now) {}
  async register(input: RegisterRequest): Promise<{ response: AuthResponse; cookie: string }> {
    const username = input.username.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);
    if (this.repository.findUsername(username)) throw new AuthError("USERNAME_TAKEN", "用户名已被使用", 409);
    const account: AccountRecord = { id: `account_${randomUUID()}`, username, displayName: input.displayName.trim(), passwordHash, status: "active" };
    this.repository.insert(account, this.now());
    return this.loginAccount(account, input.guestSeat);
  }
  async login(input: LoginRequest): Promise<{ response: AuthResponse; cookie: string }> {
    const account = this.repository.findUsername(input.username.trim().toLowerCase());
    const valid = await verifyPassword(input.password, account?.passwordHash);
    if (!account || !valid || account.status !== "active") throw new AuthError("INVALID_CREDENTIALS", "用户名或密码错误");
    const upgraded = passwordNeedsUpgrade(account.passwordHash) ? await hashPassword(input.password) : null;
    // Password changes / disable operations may have happened while scrypt yielded.
    const current = this.repository.findId(account.id);
    if (!current || current.status !== "active" || current.passwordHash !== account.passwordHash) {
      throw new AuthError("INVALID_CREDENTIALS", "用户名或密码错误");
    }
    if (upgraded) this.repository.updatePassword(account.id, upgraded, this.now());
    return this.loginAccount(current, input.guestSeat);
  }
  private loginAccount(account: AccountRecord, guestSeat?: LoginRequest["guestSeat"]) {
    const secret = randomBytes(32).toString("base64url");
    const session: SessionRecord = { id: randomUUID(), accountId: account.id, tokenHash: hashSecret(secret),
      createdAt: this.now(), lastSeenAt: this.now(), expiresAt: this.now() + this.lifetimeMs };
    const takeover = this.rooms.prepareAccountTakeover(account.id, guestSeat);
    this.repository.replaceSession(session);
    // No await between DB commit, token installation and socket eviction.
    takeover();
    return { response: this.view({ account, session, csrfToken: csrf(secret) }), cookie: `${session.id}.${secret}` };
  }
  authenticate(cookie: string | undefined): AuthContext | null {
    if (!cookie) return null;
    const parts = cookie.split(".");
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]{43}$/.test(parts[1]!)) return null;
    const session = this.repository.findSession(parts[0]!);
    if (!session || !safeEqual(session.tokenHash, hashSecret(parts[1]!))) return null;
    const account = this.repository.findId(session.accountId);
    if (!account || account.status !== "active" || session.expiresAt <= this.now()) {
      this.repository.revokeSession(session.accountId);
      this.rooms.prepareAccountTakeover(session.accountId)();
      return null;
    }
    if (this.now() - session.lastSeenAt > 300_000) this.repository.touchSession(session.id, this.now());
    return { account, session, csrfToken: csrf(parts[1]!) };
  }
  view(context: AuthContext): AuthResponse {
    return { account: publicAccount(context.account), csrfToken: context.csrfToken, activeSeat: this.rooms.accountSeat(context.account.id) };
  }
  logout(context: AuthContext): void {
    this.repository.revokeSession(context.account.id);
    this.rooms.prepareAccountTakeover(context.account.id)();
  }
  expireSessions(): void {
    for (const id of this.repository.invalidSessionAccounts(this.now())) {
      this.repository.revokeSession(id);
      this.rooms.prepareAccountTakeover(id)();
    }
  }
  async changePassword(context: AuthContext, currentPassword: string, newPassword: string): Promise<void> {
    if (!await verifyPassword(currentPassword, context.account.passwordHash)) throw new AuthError("INVALID_CREDENTIALS", "当前密码错误");
    const hash = await hashPassword(newPassword);
    const current = this.repository.findId(context.account.id);
    if (!this.repository.findSession(context.session.id) || current?.passwordHash !== context.account.passwordHash || current.status !== "active") {
      throw new AuthError("AUTH_REQUIRED", "登录已失效，请重新登录");
    }
    this.repository.updatePassword(context.account.id, hash, this.now());
    this.rooms.prepareAccountTakeover(context.account.id)();
  }
}
export function publicAccount(account: AccountRecord): AccountView {
  return { id: account.id, username: account.username, displayName: account.displayName };
}
function hashSecret(secret: string) { return createHash("sha256").update(secret).digest("hex"); }
function csrf(secret: string) { return createHmac("sha256", secret).update("account-csrf-v1").digest("base64url"); }
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
