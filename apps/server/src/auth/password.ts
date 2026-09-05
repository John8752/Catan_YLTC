import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// One 128 MiB hash at a time on the 512 MiB service; the queue is bounded too.
const COST = 131072;
let hashing = false;
const waiting: (() => void)[] = [];
async function derive(password: string, salt: string, cost: number): Promise<Buffer> {
  if (hashing) {
    if (waiting.length >= 8) throw new AuthError("AUTH_BUSY", "登录繁忙，请稍后重试", 429);
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else hashing = true;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 32, { N: cost, r: 8, p: 1, maxmem: 160 * 1024 * 1024 },
        (error, key) => error ? reject(error) : resolve(key));
    });
  } finally { const next = waiting.shift(); if (next) next(); else hashing = false; }
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${COST}$8$1$${salt}$${(await derive(password, salt, COST)).toString("hex")}`;
}
const DUMMY = `scrypt$${COST}$8$1$${"0".repeat(32)}$${"0".repeat(64)}`;
export async function verifyPassword(password: string, encoded: string = DUMMY): Promise<boolean> {
  const [algorithm, n, r, p, salt, digest] = encoded.split("$");
  if (algorithm !== "scrypt" || ![16384, 32768, 65536, COST].includes(Number(n)) || r !== "8" || p !== "1"
    || !/^[0-9a-f]{32}$/.test(salt ?? "") || !/^[0-9a-f]{64}$/.test(digest ?? "")) return false;
  return timingSafeEqual(await derive(password, salt!, Number(n)), Buffer.from(digest!, "hex"));
}
export function passwordNeedsUpgrade(hash: string): boolean { return !hash.startsWith(`scrypt$${COST}$`); }
export class AuthError extends Error {
  constructor(readonly code: import("@catan/protocol").AccountErrorCode, message: string, readonly statusCode = 401) { super(message); }
}
