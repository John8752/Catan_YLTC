import { expect, test } from "@playwright/test";
test("@platform game choice stays fixed through joining and host succession", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  const host = await first.newPage(), guest = await second.newPage();
  try {
    await host.goto("/"); await expect(host.getByRole("radio", { name: /^卡坦/ })).toBeChecked();
    await host.getByRole("radio", { name: /传画猜词/ }).check(); await host.getByLabel("显示名称", { exact: true }).fill("房主");
    await host.getByRole("button", { name: "创建传画猜词房间" }).click();
    const code = host.getByLabel("房间码", { exact: true }); await expect(code).toBeVisible();
    await expect(host.getByRole("radio")).toHaveCount(0); await expect(host.getByRole("button", { name: "开始传画猜词" })).toBeDisabled();
    await guest.goto("/"); await guest.getByLabel("显示名称", { exact: true }).fill("朋友"); await guest.getByLabel("六位房间码").fill((await code.textContent())!);
    await guest.getByRole("button", { name: "登岛", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "传画猜词", exact: true })).toBeVisible(); await expect(guest.getByLabel("画画时间", { exact: true })).toBeDisabled();
    await host.getByRole("button", { name: "离开房间", exact: true }).click();
    await expect(host.getByRole("radio", { name: /^卡坦/ })).toBeChecked(); await expect(guest.getByLabel("画画时间", { exact: true })).toBeEnabled();
    await guest.getByRole("button", { name: "解散房间", exact: true }).click();
    const dialog = guest.getByRole("dialog", { name: "确认解散房间？" }); await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "解散房间", exact: true }).click(); await expect(guest.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
  } finally { await first.close(); await second.close(); }
});
