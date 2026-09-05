import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps account session secrets out of browser storage and JavaScript cookies", () => {
  for (const name of ["auth-api.ts", "components/AccountControl.tsx", "components/AccountHistory.tsx"]) {
    const source = readFileSync(new URL(name, import.meta.url), "utf8");
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|passwordHash|tokenHash/);
  }
});
