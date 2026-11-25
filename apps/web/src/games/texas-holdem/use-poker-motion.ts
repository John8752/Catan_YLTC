import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { PokerView } from "@catan/protocol/texas-holdem";
import { PokerMotionCursor } from "./motion-cursor.js";
import { betPosition, pokerSeatPositions, type TablePoint } from "./seat-layout.js";
const labels = { fold: "弃牌", check: "过牌", call: "跟注", raise: "加注", "all-in": "全下", blind: "盲注" };

export function usePokerMotion(stage: RefObject<HTMLDivElement | null>, game: PokerView | null, epoch: number) {
  const cursor = useRef(new PokerMotionCursor()), running = useRef(new Set<Animation>()), layer = useRef<HTMLDivElement | null>(null);
  function clear() { running.current.forEach((a) => a.cancel()); running.current.clear(); layer.current?.replaceChildren(); }
  useEffect(() => () => { clear(); layer.current?.remove(); layer.current = null; }, []);
  useLayoutEffect(() => {
    const batch = cursor.current.consume(game, epoch);
    if (batch.reset) clear();
    const root = stage.current;
    if (!root) { layer.current?.remove(); layer.current = null; return; }
    if (!root || !game || !batch.effects.length || typeof root.animate !== "function") return;
    if (!layer.current) { layer.current = document.createElement("div"); layer.current.className = "pointer-events-none absolute inset-0 z-30 overflow-hidden"; layer.current.setAttribute("aria-hidden", "true"); root.append(layer.current); }
    const bounds = root.getBoundingClientRect(), reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points = pokerSeatPositions(game.players.map((p) => p.id), game.you.id, bounds.height);
    const lookup = (attribute: string, id: string) => Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`)).find((e) => e.getAttribute(attribute) === id);
    const animate = (el: HTMLElement, frames: Keyframe[], duration: number, delay = 0, remove = false) => {
      const textFeedback = el.classList.contains("poker-action-bubble");
      const a = el.animate(frames, { duration: reduced && !textFeedback ? Math.min(140, duration) : duration, delay: reduced ? 0 : delay, easing: textFeedback ? "linear" : "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
      running.current.add(a);
      const cleanup = () => { running.current.delete(a); if (remove) el.remove(); };
      a.onfinish = cleanup; a.oncancel = cleanup;
    };
    const pulse = (el: HTMLElement | undefined, type: string, delay = 0) => { if (!el) return; el.dataset.pokerFeedback = type; animate(el, reduced ? [{ opacity: .5 }, { opacity: 1 }] : [{ filter: "brightness(1.65)", transform: "scale(1.06)" }, { filter: "brightness(1)", transform: "scale(1)" }], 400, delay); };
    const flight = (kind: "chip" | "card", from: TablePoint, to: TablePoint, delay: number, tilt = 0) => {
      const el = document.createElement("span"); el.className = `poker-flight poker-flight-${kind}`; el.dataset.pokerMotion = kind; el.style.left = `${from.x}%`; el.style.top = `${from.y}%`; layer.current!.append(el);
      const dx = (to.x - from.x) * bounds.width / 100, dy = (to.y - from.y) * bounds.height / 100;
      const frames: Keyframe[] = reduced ? [{ opacity: .8 }, { opacity: 0 }] : [{ transform: `translate(-50%,-50%) rotate(${tilt}deg) scale(.75)`, opacity: 0 }, { offset: .15, opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${tilt + 12}deg) scale(${kind === "card" ? .65 : 1})`, opacity: .85 }, { offset: 1, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.45)`, opacity: 0 }];
      animate(el, frames, kind === "chip" ? 440 : 400, delay, true);
    };
    const bubble = (id: string, label: string, action: string, delay: number) => {
      const point = points.get(id); if (!point) return;
      layer.current!.querySelectorAll<HTMLElement>("[data-poker-bubble-player]").forEach((el) => { if (el.dataset.pokerBubblePlayer === id) { el.getAnimations().forEach((a) => a.cancel()); el.remove(); } });
      const el = document.createElement("span"); el.className = "poker-flight poker-action-bubble"; el.dataset.action = action; el.dataset.pokerMotion = "action"; el.dataset.pokerBubblePlayer = id; el.textContent = label; el.style.whiteSpace = "pre";
      el.style.left = `${point.x}%`; el.style.top = `${point.y + 1}%`; layer.current!.append(el);
      animate(el, reduced ? [{ opacity: .4 }, { opacity: 1, offset: .05 }, { opacity: 1, offset: .95 }, { opacity: 0 }] : [{ opacity: 0, transform: "translate(-50%,0) scale(.8)", easing: "cubic-bezier(.16,1,.3,1)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .1 }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: .9 }, { opacity: 0, transform: "translate(-50%,-65%) scale(.98)" }], 1800, delay, true);
    };
    const settlements = new Map<string, { award: number; refund: number }>(), shownSettlements = new Set<string>();
    for (const e of batch.effects) if (e.kind === "award" || e.kind === "refund") { const totals = settlements.get(e.playerId) ?? { award: 0, refund: 0 }; totals[e.kind] += e.amount; settlements.set(e.playerId, totals); }
    let delay = 0;
    for (const effect of batch.effects) {
      root.dataset.lastPokerEffect = effect.id;
      switch (effect.kind) {
        case "deal": {
          for (let round = 0; round < 2; round++) effect.playerIds.forEach((id, i) => { const p = points.get(id); if (p) flight("card", { x: 50, y: 23 }, p, (round * effect.playerIds.length + i) * 36, round ? 6 : -6); });
          root.querySelectorAll<HTMLElement>(".poker-own-hand [data-card]").forEach((c, i) => animate(c, reduced ? [{ opacity: .4 }, { opacity: 1 }] : [{ opacity: .4, transform: "translateY(-20px) rotateY(85deg)" }, { opacity: 1, transform: "translateY(0) rotateY(0)" }], 420, 450 + i * 90));
          delay = 650; break;
        }
        case "action": {
          const p = points.get(effect.playerId); if (!p) break;
          bubble(effect.playerId, `${labels[effect.action]}${effect.paid ? ` ${effect.paid}` : ""}`, effect.action, delay);
          pulse(lookup("data-poker-avatar", effect.playerId), effect.action, delay);
          if (effect.action === "fold") for (let i = 0; i < 2; i++) flight("card", p, { x: 18, y: 69 }, delay + i * 50, i ? 14 : -14);
          else if (effect.paid > 0) for (let i = 0; i < (effect.action === "all-in" ? 5 : 3); i++) flight("chip", { x: p.x + i * .5, y: p.y }, betPosition(p), delay + i * 45);
          delay += 300; break;
        }
        case "collect": effect.bets.forEach((b, i) => { const p = points.get(b.playerId); if (p) flight("chip", betPosition(p), { x: 50, y: 33 }, delay + i * 22); }); delay += 380; break;
        case "board": for (let i = effect.fromIndex; i < effect.fromIndex + effect.count; i++) { const c = root.querySelector<HTMLElement>(`[data-board-index="${i}"]`); if (c) animate(c, reduced ? [{ opacity: .4 }, { opacity: 1 }] : [{ transform: "rotateY(90deg)", opacity: .4 }, { transform: "rotateY(0)", opacity: 1 }], 400, delay + (i - effect.fromIndex) * 120); } delay += 450 + effect.count * 90; break;
        case "showdown": effect.playerIds.filter((id) => id !== game.you.id).forEach((id) => { lookup("data-poker-seat", id)?.querySelectorAll<HTMLElement>("[data-card]").forEach((card, i) => animate(card, reduced ? [{ opacity: .4 }, { opacity: 1 }] : [{ transform: "rotateY(90deg)" }, { transform: "rotateY(0)" }], 400, delay + i * 80)); }); delay += 450; break;
        case "award": case "refund": {
          if (shownSettlements.has(effect.playerId)) break;
          shownSettlements.add(effect.playerId);
          const p = points.get(effect.playerId); if (!p) break;
          for (let i = 0; i < 4; i++) flight("chip", { x: 50 + i * .7, y: 33 }, p, delay + i * 55);
          const totals = settlements.get(effect.playerId)!;
          bubble(effect.playerId, [totals.award ? `收池 +${totals.award}` : "", totals.refund ? `退回 +${totals.refund}` : ""].filter(Boolean).join("\n"), totals.award ? "award" : "refund", delay + 250); pulse(lookup("data-poker-stack", effect.playerId), totals.award ? "award" : "refund", delay + 350); break;
        }
      }
    }
  }, [game?.id, game?.revision, epoch]);
}
