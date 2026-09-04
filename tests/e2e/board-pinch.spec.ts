import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type CDPSession } from "@playwright/test";
import { fixture, openFixture } from "./layout-fixture.js";
import { primaryPhoneCases } from "./viewport-cases.js";

const touchCases = primaryPhoneCases.filter(({ name }) => name.includes("browser-area"));

for (const { name, width, height, options } of touchCases) {
  test(`two-finger pinch zooms around its midpoint at ${name}`, async ({ browser }) => {
    const run = await openFixture(browser, width, height, fixture(6), options);
    const session = await run.context.newCDPSession(run.page);
    try {
      const stage = run.page.getByRole("region", { name: "可移动地图视口", exact: true });
      const transform = run.page.locator(".board-transform");
      const bounds = await stage.boundingBox();
      if (bounds === null) throw new Error("Map viewport has no bounds");

      const initialTransform = await computedTransform(transform);
      const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const startRadius = Math.min(bounds.width, bounds.height) * 0.1;
      const endRadius = startRadius * 1.8;
      await dispatchTouches(session, "touchStart", [
        { id: 1, x: center.x - startRadius, y: center.y },
        { id: 2, x: center.x + startRadius, y: center.y },
      ]);
      await dispatchTouches(session, "touchMove", [
        { id: 1, x: center.x - endRadius + 8, y: center.y + 6 },
        { id: 2, x: center.x + endRadius + 8, y: center.y + 6 },
      ]);

      await expect(stage).toHaveAttribute("data-gesture-active", "true");
      await expect.poll(async () => Number.parseInt(await run.page.locator(".board-zoom-level").innerText(), 10))
        .toBeGreaterThan(108);
      await expect.poll(() => computedTransform(transform)).not.toBe(initialTransform);

      await dispatchTouches(session, "touchEnd", []);
      await expect(stage).not.toHaveAttribute("data-gesture-active", "true");
      expect(await run.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1)).toBe(false);

      const artifactDir = path.join(process.cwd(), "output/playwright");
      await mkdir(artifactDir, { recursive: true });
      await run.page.screenshot({
        path: path.join(artifactDir, `pinch-${slug(name)}.png`),
        fullPage: true,
        scale: "css",
      });

      await run.page.getByRole("button", { name: "恢复地图大小" }).click();
      await expect.poll(() => computedTransform(transform)).toBe(initialTransform);
      expect(run.errors).toEqual([]);
    } finally {
      await session.detach();
      await run.context.close();
    }
  });
}

async function dispatchTouches(
  session: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  points: readonly { id: number; x: number; y: number }[],
): Promise<void> {
  await session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point) => ({ ...point, radiusX: 4, radiusY: 4, force: 1 })),
  });
}

async function computedTransform(locator: import("@playwright/test").Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).transform);
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
