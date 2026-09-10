import { expect, test } from "@playwright/test";
import { primaryPhoneCases } from "../viewport-cases.js";

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, ...primaryPhoneCases]) {
  test(`self-hosted Chinese typography loads and keeps entry controls readable ${device.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext(device.options);
    const page = await context.newPage();
    const failedFonts: string[] = [];
    page.on("requestfailed", (request) => { if (request.resourceType() === "font") failedFonts.push(request.url()); });
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.load('400 16px "Noto Sans SC Variable"', "祥子静雯大鹏大靖丁丁踢踢");
        await document.fonts.ready;
      });
      const fonts = await page.evaluate(() => ({
        loaded: [...document.fonts].some((font) => font.family.includes("Noto Sans SC") && font.status === "loaded"),
        urls: performance.getEntriesByType("resource").filter((entry) => entry.name.includes(".woff2")).map((entry) => entry.name),
        family: getComputedStyle(document.querySelector("h1")!).fontFamily,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(fonts.loaded).toBe(true);
      expect(fonts.family).toContain("Noto Sans SC");
      expect(fonts.urls.length).toBeGreaterThan(0);
      expect(fonts.urls.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
      expect(fonts.overflow).toBe(false);
      const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const lineHeight = await page.getByRole("heading", { level: 1 }).evaluate((element) => Number.parseFloat(getComputedStyle(element).lineHeight));
      expect(title.height).toBeLessThanOrEqual(lineHeight * 2 + 1);
      expect(failedFonts).toEqual([]);
      await page.getByRole("textbox", { name: "显示名称", exact: true }).fill("静雯和她的朋友们");
      await expect(page.getByRole("button", { name: "创建今晚的岛", exact: true })).toBeEnabled();
      await page.screenshot({ path: testInfo.outputPath("welcome-font.png"), fullPage: true, scale: "css" });
    } finally { await context.close(); }
  });
}

test("entry remains usable when font downloads fail", async ({ page }) => {
  await page.route("**/*.woff2", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("textbox", { name: "显示名称", exact: true }).fill("祥子");
  await expect(page.getByRole("button", { name: "创建今晚的岛", exact: true })).toBeEnabled();
});
