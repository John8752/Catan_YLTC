/** Presentation timing only; authoritative endpoints come from the room view. */
export function movementFrame(from: number, to: number, elapsed: number, reduced = false) {
  const steps = Math.max(1, Math.abs(to - from));
  const progress = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - 650) / (steps * 420)));
  const travelled = progress * steps, segment = Math.min(steps - 1, Math.floor(travelled));
  const local = progress === 1 ? 1 : travelled - segment;
  const eased = local * local * (3 - 2 * local);
  return { space: from + (to - from) * (segment + eased) / steps,
    progress, hop: reduced || progress === 1 ? 0 : Math.sin(local * Math.PI) * .42 };
}
