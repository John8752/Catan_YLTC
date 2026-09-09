import { expect, it, vi } from "vitest";
import { createGameAudio, synthesizeGameSound } from "./game-audio.js";

it("generates distinct finite, bounded cues with quiet endpoints", () => {
  for (const sound of ["dice-roll", "your-turn"] as const) {
    const samples = synthesizeGameSound(sound, 44100);
    let peak = 0, energy = 0;
    for (const value of samples) { expect(Number.isFinite(value)).toBe(true); peak = Math.max(peak, Math.abs(value)); energy += value * value; }
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.5);
    expect(energy).toBeGreaterThan(1);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples.at(-1)!)).toBeLessThan(0.0001);
  }
});

function mockContext() {
  const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, onended: null };
  const context = {
    state: "suspended", sampleRate: 44100, destination: {},
    resume: vi.fn(async () => { context.state = "running"; }),
    close: vi.fn(async () => { context.state = "closed"; }),
    createBuffer: vi.fn(() => ({ copyToChannel: vi.fn() })),
    createBufferSource: vi.fn(() => source),
  };
  return { context, source, audio: createGameAudio(() => context as unknown as AudioContext) };
}

it("does not queue locked sounds, unlocks on demand and stops when muted/disposed", async () => {
  const { audio, context, source } = mockContext();
  audio.play("dice-roll");
  expect(source.start).not.toHaveBeenCalled();
  audio.unlock();
  await Promise.resolve();
  expect(context.resume).toHaveBeenCalledOnce();
  expect(source.start).not.toHaveBeenCalled();
  audio.play("dice-roll");
  expect(source.start).toHaveBeenCalledOnce();
  audio.setMuted(true);
  expect(source.stop).toHaveBeenCalledOnce();
  audio.play("your-turn");
  expect(source.start).toHaveBeenCalledOnce();
  audio.setMuted(false);
  context.state = "suspended";
  audio.play("your-turn");
  expect(source.start).toHaveBeenCalledOnce();
  audio.dispose();
  expect(context.close).toHaveBeenCalledOnce();
});

it("degrades silently when audio is absent, creation fails, or resume is rejected", async () => {
  for (const factory of [() => null, () => { throw new Error("Unavailable"); }]) {
    const audio = createGameAudio(factory);
    expect(() => { audio.unlock(); audio.play("dice-roll"); audio.dispose(); }).not.toThrow();
  }
  const { audio, context, source } = mockContext();
  context.resume.mockRejectedValue(new Error("Blocked"));
  audio.unlock();
  await Promise.resolve();
  audio.play("your-turn");
  expect(source.start).not.toHaveBeenCalled();
});
