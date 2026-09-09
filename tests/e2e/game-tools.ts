import { expect, type Page } from "@playwright/test";

export async function openGameMenu(page: Page) {
  const trigger = page.getByRole("button", { name: "打开游戏菜单", exact: true });
  if (await trigger.isVisible()) await trigger.click();
}

export async function clickGameTool(page: Page, name: string | RegExp) {
  const target = page.getByRole("button", { name });
  if (!await target.isVisible()) await openGameMenu(page);
  await target.click();
}

export async function closeGameMenu(page: Page) {
  const menu = page.getByRole("dialog", { name: "游戏菜单", exact: true });
  if (await page.getByRole("dialog", { name: "游戏菜单", exact: true, includeHidden: true }).count()) {
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "打开游戏菜单" })).toBeFocused();
  }
}
