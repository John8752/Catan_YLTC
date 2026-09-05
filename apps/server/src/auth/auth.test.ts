import { afterEach, expect, it } from "vitest";
import type { AuthResponse, PlayerSessionResponse } from "@catan/protocol";
import { buildApp } from "../app.js";
import { RoomRegistry } from "../rooms.js";
import { SqliteDatabase } from "../database/sqlite-database.js";
import { SqliteAccountRepository } from "../database/sqlite-account-repository.js";
import { AccountService } from "./account-service.js";
import { hashPassword, verifyPassword } from "./password.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });
const credentials = { username: "Alice", displayName: "北岸旅人", password: "test-password-12345" };
const origin = "http://localhost:80";
async function setup() { const registry = new RoomRegistry(); const app = await buildApp(registry); apps.push(app); return { app, registry }; }
async function register(app: Awaited<ReturnType<typeof buildApp>>) {
  const result = await app.inject({ method: "POST", url: "/api/auth/register", headers: { origin }, payload: credentials });
  expect(result.statusCode, result.body).toBe(200);
  return { response: result.json<AuthResponse>(), cookie: String(result.headers["set-cookie"]).split(";")[0]! };
}

it("replaces login globally, rotates seat before socket eviction, rejects old HTTP/WS tokens and preserves guest privacy", async () => {
  const { app, registry } = await setup(); const first = await register(app);
  const headers = { origin, cookie: first.cookie, "x-csrf-token": first.response.csrfToken };
  const hostResult = await app.inject({ method: "POST", url: "/api/rooms", headers, payload: { playerName: "ignored" } });
  expect(hostResult.statusCode, hostResult.body).toBe(201);
  const host = hostResult.json<PlayerSessionResponse>();
  const guest = registry.joinRoom(host.roomId, "游客");
  registry.startRoom(host.roomId, host.seatToken);
  let evicted = false;
  registry.subscribe(host.roomId, host.seatToken, () => {}, undefined, () => {
    expect(() => registry.getRoom(host.roomId, host.seatToken)).toThrow("credential"); evicted = true;
  });
  const second = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: credentials });
  expect(second.statusCode, second.body).toBe(200);
  const replacement = second.json<AuthResponse>();
  expect(evicted).toBe(true);
  expect(replacement.activeSeat).toMatchObject({ roomId: host.roomId, playerId: host.playerId });
  expect(replacement.activeSeat?.seatToken).not.toBe(host.seatToken);
  expect((await app.inject({ method: "GET", url: "/api/account/matches", headers: { cookie: first.cookie } })).statusCode).toBe(401);
  expect(() => registry.subscribe(host.roomId, host.seatToken, () => {})).toThrow();
  expect((await app.inject({ method: "GET", url: `/api/rooms/${host.roomId}?seatToken=${host.seatToken}` })).statusCode).toBe(400);
  expect((await app.inject({ method: "POST", url: `/api/rooms/${host.roomId}/commands`, payload: { seatToken: host.seatToken, commandId: "old", expectedRevision: 1, command: { type: "RollDice" } } })).statusCode).toBe(400);
  const guestView = registry.getRoom(guest.roomId, guest.seatToken);
  expect(JSON.stringify(guestView)).not.toContain(first.response.account.id);
  expect(JSON.stringify(guestView)).not.toContain("passwordHash");
  const nextHeaders = { origin, cookie: String(second.headers["set-cookie"]).split(";")[0]!, "x-csrf-token": replacement.csrfToken };
  const same = await app.inject({ method: "POST", url: "/api/rooms", headers: nextHeaders, payload: { playerName: "another" } });
  expect(same.json<PlayerSessionResponse>().playerId).toBe(host.playerId);
  await app.inject({ method: "PATCH", url: "/api/account/profile", headers: nextHeaders, payload: { displayName: "新名称" } });
  expect(registry.getRoom(host.roomId, replacement.activeSeat!.seatToken).members[0]?.name).toBe(credentials.displayName);
  await app.inject({ method: "POST", url: "/api/auth/logout", headers: nextHeaders, payload: {} });
  expect(() => registry.getRoom(host.roomId, replacement.activeSeat!.seatToken)).toThrow();
  const third = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: credentials });
  expect(third.json<AuthResponse>().activeSeat?.playerId).toBe(host.playerId);
});

it("rejects CSRF, foreign origins and invalid credentials; uses HttpOnly HTTP cookie and no secret response fields", async () => {
  const { app } = await setup(); const first = await register(app);
  expect(first.cookie).toMatch(/^catan_account_session=/);
  const headers = { origin, cookie: first.cookie };
  expect((await app.inject({ method: "PATCH", url: "/api/account/profile", headers, payload: { displayName: "修改" } })).statusCode).toBe(403);
  const badOrigin = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin: "http://evil.example" }, payload: credentials });
  expect(badOrigin.statusCode).toBe(403);
  const wrong = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: { ...credentials, password: "wrong" } });
  const absent = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: { ...credentials, username: "missing" } });
  expect(wrong.body).toBe(absent.body);
  expect(first.response.account).toEqual({ id: expect.any(String), username: "alice", displayName: credentials.displayName });
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
  expect(me.headers["cache-control"]).toBe("no-store");
  expect(me.body).not.toContain(first.cookie.split("=")[1]);
});

it("claims an existing guest seat during registration and serializes racing logins", async () => {
  const { app, registry } = await setup(); const guest = registry.createRoom("游客");
  const registered = await app.inject({ method: "POST", url: "/api/auth/register", headers: { origin }, payload: { ...credentials, guestSeat: { roomId: guest.roomId, seatToken: guest.seatToken } } });
  expect(registered.json<AuthResponse>().activeSeat?.playerId).toBe(guest.playerId);
  const responses = await Promise.all([1, 2].map(() => app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: credentials })));
  const valid = await Promise.all(responses.map((response) => app.inject({ method: "GET", url: "/api/account/matches", headers: { cookie: String(response.headers["set-cookie"]).split(";")[0]! } })));
  expect(valid.filter((response) => response.statusCode === 200)).toHaveLength(1);
  expect(responses.map((response) => response.json<AuthResponse>().activeSeat?.playerId)).toEqual([guest.playerId, guest.playerId]);
});

it("expires sessions, hashes passwords and revokes on password change", async () => {
  const database = new SqliteDatabase(":memory:"); const rooms = new RoomRegistry();
  let now = 100; const repository = new SqliteAccountRepository(database);
  const service = new AccountService(repository, rooms, 100, () => now);
  const registered = await service.register(credentials);
  const context = service.authenticate(registered.cookie)!;
  expect(repository.findId(context.account.id)?.passwordHash).not.toContain(credentials.password);
  await service.changePassword(context, credentials.password, "new-password-12345");
  expect(service.authenticate(registered.cookie)).toBeNull();
  const second = await service.login({ username: credentials.username, password: "new-password-12345" });
  now = 201; expect(service.authenticate(second.cookie)).toBeNull();
  const hash = await hashPassword("round-trip-password");
  expect(await verifyPassword("round-trip-password", hash)).toBe(true);
  expect(await verifyPassword("wrong", hash)).toBe(false);
  rooms.dispose(); database.close();
}, 15_000);

for (const input of [
  { username: "X", password: "a", displayName: "甲" },
  { username: "Long_".repeat(20), password: "密码".repeat(100), displayName: "很长的账号显示名称".repeat(10) },
]) {
  it(`accepts nonempty credentials without character-count bounds (${input.username.length}/${input.password.length})`, async () => {
    const { app } = await setup();
    const registered = await app.inject({ method: "POST", url: "/api/auth/register", headers: { origin }, payload: input });
    expect(registered.statusCode, registered.body).toBe(200);
    const loggedIn = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: input });
    expect(loggedIn.statusCode, loggedIn.body).toBe(200);
    const auth = loggedIn.json<AuthResponse>();
    expect(auth.account).toMatchObject({ username: input.username.toLowerCase(), displayName: input.displayName });
    const headers = { origin, cookie: String(loggedIn.headers["set-cookie"]).split(";")[0]!, "x-csrf-token": auth.csrfToken };
    const room = await app.inject({ method: "POST", url: "/api/rooms", headers, payload: { playerName: "ignored" } });
    expect(room.statusCode, room.body).toBe(201);
    expect(room.json<PlayerSessionResponse>().room.members[0]?.name).toBe(input.displayName);
    const profile = await app.inject({ method: "PATCH", url: "/api/account/profile", headers, payload: { displayName: input.displayName + "新" } });
    expect(profile.statusCode, profile.body).toBe(200);
    const newPassword = input.password.length === 1 ? "很长的新密码".repeat(100) : "b";
    const changed = await app.inject({ method: "POST", url: "/api/account/change-password", headers, payload: { currentPassword: input.password, newPassword } });
    expect(changed.statusCode, changed.body).toBe(200);
    const relogin = await app.inject({ method: "POST", url: "/api/auth/login", headers: { origin }, payload: { username: input.username, password: newPassword } });
    expect(relogin.statusCode, relogin.body).toBe(200);
  }, 20_000);
}

it("still requires nonempty account credentials and display names", async () => {
  const { app } = await setup();
  for (const input of [{ ...credentials, username: "" }, { ...credentials, password: "" }, { ...credentials, displayName: "  " }]) {
    const response = await app.inject({ method: "POST", url: "/api/auth/register", headers: { origin }, payload: input });
    expect(response.statusCode).toBe(400);
  }
});
