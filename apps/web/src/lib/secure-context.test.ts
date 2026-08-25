import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Production runs on plain HTTP at a bare IP, which is not a secure context, so browsers
 * leave these APIs undefined. Local development on localhost *is* a secure context and
 * hides the breakage entirely — hence this test rather than a manual review habit.
 * See "Insecure-context constraint" in AGENTS.md.
 */
const BLOCKED = [
  "crypto.subtle",
  "navigator.clipboard",
  "navigator.share",
  "navigator.geolocation",
  "navigator.mediaDevices",
  "navigator.serviceWorker",
  "navigator.credentials",
  "navigator.wakeLock",
  "navigator.storage",
  "navigator.bluetooth",
  "navigator.usb",
  "navigator.serial",
  "navigator.hid",
  "PushManager",
  "PaymentRequest",
  "IdleDetector",
  "getUserMedia",
];

const SRC = fileURLToPath(new URL("..", import.meta.url));

/** Guarded behind a feature test inside this helper; every other file must go through it. */
const RANDOM_UUID_OWNER = "lib/random-id.ts";

describe("insecure-context safety", () => {
  const files = sourceFiles(SRC).filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"));

  it("covers the whole app source", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("calls no secure-context-only Web API", () => {
    const offences = files.flatMap((path) =>
      BLOCKED.filter((api) => readFileSync(path, "utf8").includes(api)).map((api) => `${relative(path)} → ${api}`),
    );

    expect(offences).toEqual([]);
  });

  it("routes every id through randomId, the one guarded crypto.randomUUID call site", () => {
    const offences = files
      .filter((path) => !relative(path).endsWith(RANDOM_UUID_OWNER))
      .filter((path) => readFileSync(path, "utf8").includes("randomUUID"))
      .map(relative);

    expect(offences).toEqual([]);
  });

  it("never hardcodes a TLS-only scheme", () => {
    const offences = files
      .filter((path) => /(["'`])wss:\/\//.test(readFileSync(path, "utf8")))
      .map(relative);

    expect(offences).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function relative(path: string): string {
  return path.slice(SRC.length).replaceAll("\\", "/");
}
