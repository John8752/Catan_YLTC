import { clickGameTool, closeGameMenu } from "./game-tools.js";
import { createGame, executeGameCommand, type GameCommand, type GameEventRecord, type GameState } from "../../packages/game-core/src/catan.js";
import { projectGameForPlayer } from "../../packages/protocol/src/catan/index.js";
import { expect, test, type Page } from "@playwright/test";
import { fixture, openFixture, measure } from "./layout-fixture.js";
import { primaryPhoneCases, viewportCase } from "./viewport-cases.js";

type AudioProbe = { durations: number[]; context: AudioContext | null };
async function installAudioProbe(page: Page) {
  await page.evaluate(() => {
    const probe: AudioProbe = { durations: [], context: null };
    Object.assign(window, { audioProbe: probe });
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor() { super(); probe.context = this; }
      override createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        source.start = (...args) => {
          probe.durations.push(source.buffer?.duration ?? 0);
          start(...args);
        };
        return source;
      }
    };
  });
}
const sounds = (page: Page) => page.evaluate(() => (window as unknown as { audioProbe: AudioProbe }).audioProbe.durations.map((d) => Math.round(d * 100)));

for (const count of [4, 6] as const) {
  for (const viewport of [...primaryPhoneCases, viewportCase(1280, 800)]) {
    test(`roll keeps actions available and plays distinct live cues for ${count} seats at ${viewport.name}`, async ({ browser }, testInfo) => {
      const template = fixture(count);
      const base = createGame({ id: "audio-e2e", seed: 42, players: template.members, ruleProfile: template.settings.ruleProfile });
      let state: GameState = { ...base, revision: 1, phase: { kind: "turn", step: "action", activePlayerId: "p2", turnNumber: 1 } };
      let records: GameEventRecord[] = [];
      const room = () => ({ ...template, revision: state.revision, game: projectGameForPlayer(state, "p1", records) });
      const run = await openFixture(browser, viewport.width, viewport.height, room(), viewport.options);
      const { page } = run;
      const submitted: string[] = [];
      await page.route("**/api/rooms/LAYOUT/commands", async (route) => {
        const body = route.request().postDataJSON();
        const command = body.command as GameCommand;
        const result = executeGameCommand(state, "p1", command, { next: () => 0.2 });
        expect(result.accepted).toBe(true);
        state = result.state;
        records = [...records, ...result.events.map((event) => ({ revision: state.revision, event }))];
        submitted.push(command.type);
        run.push(room());
        await route.fulfill({ json: { commandId: body.commandId, room: room() } });
      });
      try {
        await installAudioProbe(page);
        // A real trusted gesture unlocks the real browser AudioContext.
        await clickGameTool(page, "关闭游戏音效");
        await clickGameTool(page, "开启游戏音效");
        await closeGameMenu(page);
        await expect.poll(() => page.evaluate(() => (window as unknown as { audioProbe: AudioProbe }).audioProbe.context?.state)).toBe("running");
        expect(await sounds(page)).toEqual([]);
        state = { ...state, revision: 2, phase: { kind: "turn", activePlayerId: "p1", step: "roll", turnNumber: 2 } };
        run.push(room());
        await expect(page.getByRole("button", { name: "掷骰子", exact: true })).toBeVisible();
        await expect.poll(() => sounds(page)).toEqual([85]);
        await page.getByRole("button", { name: "掷骰子", exact: true }).click();
        const end = page.getByRole("button", { name: "结束回合", exact: true });
        await expect(end).toBeVisible();
        await expect(end).toBeInViewport({ ratio: 1 });
        await expect.poll(() => sounds(page)).toEqual([85, 65]);
        run.push(room());
        await expect(page.getByRole("button", { name: "结束回合", exact: true })).toBeEnabled();
        const metrics = await measure(page);
        expect(metrics.overflow).toBe(false);
        expect(metrics.terrainFit).toBe(true);
        expect(metrics.maxPortOverflow).toBeLessThanOrEqual(metrics.tile.width * 0.2);
        expect(metrics.portNumberOverlaps).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("after-roll.png"), fullPage: true, scale: "css" });
        await end.click();
        await expect.poll(() => submitted).toEqual(["RollDice", "EndTurn"]);
        await expect(end).toBeHidden();
        expect(await sounds(page)).toEqual([85, 65]);

        // Muted events are consumed and never replay when sound is re-enabled.
        await clickGameTool(page, "关闭游戏音效");
        await closeGameMenu(page);
        state = { ...state, revision: state.revision + 1, phase: { kind: "turn", activePlayerId: "p1", step: "roll", turnNumber: 3 } };
        run.push(room());
        await page.getByRole("button", { name: "掷骰子", exact: true }).click();
        await expect(end).toBeVisible();
        await clickGameTool(page, "开启游戏音效");
        await closeGameMenu(page);
        expect(await sounds(page)).toEqual([85, 65]);
        expect(run.errors).toEqual([]);
      } finally { await run.context.close(); }
    });
  }
}
