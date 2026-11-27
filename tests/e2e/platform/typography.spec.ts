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
        await document.fonts.load('600 30px "YLTC Table Serif"', "今晚，开哪一桌？");
        await document.fonts.ready;
      });
      const fonts = await page.evaluate(() => ({
        loaded: [...document.fonts].some((font) => font.family.includes("Noto Sans SC") && font.status === "loaded"),
        displayLoaded: [...document.fonts].some((font) => font.family.includes("YLTC Table Serif") && font.status === "loaded"),
        urls: performance.getEntriesByType("resource").filter((entry) => entry.name.includes(".woff2")).map((entry) => entry.name),
        family: getComputedStyle(document.querySelector("h1")!).fontFamily,
        bodyFamily: getComputedStyle(document.body).fontFamily,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(fonts.loaded).toBe(true);
      expect(fonts.displayLoaded).toBe(true);
      expect(fonts.family).toContain("YLTC Table Serif");
      expect(fonts.bodyFamily).toContain("Noto Sans SC");
      expect(fonts.urls.length).toBeGreaterThan(0);
      expect(fonts.urls.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
      expect(fonts.overflow).toBe(false);
      const title = (await page.getByRole("heading", { level: 1 }).boundingBox())!;
      const lineHeight = await page.getByRole("heading", { level: 1 }).evaluate((element) => Number.parseFloat(getComputedStyle(element).lineHeight));
      expect(title.height).toBeLessThanOrEqual(lineHeight * 2 + 1);
      expect(failedFonts).toEqual([]);
      await page.getByRole("textbox", { name: "显示名称", exact: true }).fill("静雯和她的朋友们");
      const create = page.getByRole("button", { name: "创建卡坦房间", exact: true });
      await expect(create).toBeEnabled();
      await expect(create).toHaveCSS("font-weight", "600");
      const join = page.getByRole("button", { name: "加入房间", exact: true });
      await expect(join).toHaveCSS("font-size", "14px");
      await expect(join).toHaveCSS("font-weight", "500");
      const roomCode = page.getByRole("textbox", { name: "六位房间码", exact: true });
      expect(await roomCode.evaluate(e => getComputedStyle(e).fontFamily)).toContain("monospace");
      await expect(roomCode).toHaveCSS("font-size", "16px");
      await page.getByRole("radio", { name: "骆驼大赛", exact: true }).check();
      const camelTitle = page.getByRole("heading", { name: "骆驼大赛", exact: true });
      await page.evaluate(() => document.fonts.load('400 22px "YLTC Smiley Sans"', "骆驼大赛"));
      await expect(camelTitle).toHaveCSS("font-weight", "400");
      expect(await camelTitle.evaluate(e => getComputedStyle(e).fontFamily)).toContain("YLTC Smiley Sans");
      await page.screenshot({ path: testInfo.outputPath("welcome-font.png"), fullPage: true, scale: "css" });
    } finally { await context.close(); }
  });
}

for (const device of [{ name: "desktop", options: { viewport: { width: 1280, height: 800 } } }, primaryPhoneCases[1]!]) {
  test(`entry remains usable when font downloads fail ${device.name}`, async ({ browser }) => {
    const context = await browser.newContext(device.options), page = await context.newPage();
    try {
      await page.route("**/*.woff2", (route) => route.abort());
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      const title = page.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible();
      const box = (await title.boundingBox())!;
      const lineHeight = await title.evaluate(e => parseFloat(getComputedStyle(e).lineHeight));
      expect(box.height).toBeLessThanOrEqual(lineHeight * 2 + 1);
      await page.getByRole("textbox", { name: "显示名称", exact: true }).fill("祥子");
      await expect(page.getByRole("button", { name: "创建卡坦房间", exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    } finally { await context.close(); }
  });
}
