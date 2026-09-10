import { expect, test, type Page } from "@playwright/test";

test("lobby players can release seats and transfer or close the room", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [host, guest] = await Promise.all(contexts.map((context) => context.newPage()));

  try {
    await Promise.all([host.goto("/"), guest.goto("/")]);
    await host.getByRole("textbox", { name: "显示名称" }).fill("林");
    await host.getByRole("button", { name: "创建今晚的岛" }).click();
    const roomCode = (await host.locator(".room-code").textContent())?.trim() ?? "";
    await joinRoom(guest, "岚", roomCode);
    await expect(host.getByText("2/4")).toBeVisible();

    await guest.getByRole("button", { name: "离开房间" }).click();
    await expect(guest.getByRole("dialog", { name: "确认离开房间？" })).toContainText("座位会立即释放");
    await guest.getByRole("button", { name: "确认离开" }).click();
    await expect(guest.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(host.getByText("1/4")).toBeVisible();

    await joinRoom(guest, "岚", roomCode);
    await host.getByRole("button", { name: "离开房间" }).click();
    await expect(host.getByRole("dialog", { name: "确认离开房间？" })).toContainText("房主将自动转交给 岚");
    await host.getByRole("button", { name: "确认离开" }).click();
    await expect(host.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    await expect(guest.getByText("房主可调整")).toBeVisible();
    await expect(guest.getByText("1/4")).toBeVisible();

    await guest.getByRole("button", { name: "离开房间" }).click();
    await expect(guest.getByRole("dialog", { name: "确认离开房间？" })).toContainText("房间会立即关闭");
    await guest.getByRole("button", { name: "确认离开" }).click();
    await expect(guest.getByRole("button", { name: "创建今晚的岛" })).toBeVisible();
    const deletedRoom = await guest.request.get(`/api/rooms/${roomCode}?seatToken=removed`);
    expect(deletedRoom.status()).toBe(404);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

async function joinRoom(page: Page, name: string, roomCode: string): Promise<void> {
  await page.getByRole("textbox", { name: "显示名称" }).fill(name);
  await page.getByRole("textbox", { name: "六位房间码" }).fill(roomCode);
  await page.getByRole("button", { name: "登岛" }).click();
  await expect(page.locator(".room-code")).toHaveText(roomCode);
}
