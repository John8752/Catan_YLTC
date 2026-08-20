import type { PublicGameEffectView } from "@catan/protocol";
import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useState } from "react";

const RESOURCE_TYPES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCE_TYPES)[number];

interface ResourceFlight {
  readonly id: string;
  readonly playerId: string;
  readonly resource: Resource;
  readonly amount: number;
  readonly startX: number;
  readonly startY: number;
  readonly midX: number;
  readonly midY: number;
  readonly endX: number;
  readonly endY: number;
  readonly delay: number;
}

export function ResourceEffectLayer({
  effect,
  onComplete,
}: {
  readonly effect: PublicGameEffectView | null;
  readonly onComplete: () => void;
}) {
  const [flights, setFlights] = useState<readonly ResourceFlight[]>([]);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (effect === null) {
      setFlights([]);
      return;
    }

    const nextFlights = reducedMotion ? [] : measureFlights(effect);
    setFlights(nextFlights);
    animateSources(effect, reducedMotion);

    const arrivalTimers = reducedMotion
      ? [window.setTimeout(() => animateTargets(effect, true), 40)]
      : nextFlights.length === 0
        ? [window.setTimeout(() => animateTargets(effect, false), 760)]
        : nextFlights.map((flight) => window.setTimeout(() => animateFlightTarget(flight), 650 + flight.delay));
    const longestDelay = nextFlights.reduce((maximum, flight) => Math.max(maximum, flight.delay), 0);
    const completionTimer = window.setTimeout(onComplete, reducedMotion ? 320 : 1_080 + longestDelay);
    return () => {
      for (const timer of arrivalTimers) window.clearTimeout(timer);
      window.clearTimeout(completionTimer);
    };
  }, [effect, onComplete, reducedMotion]);

  if (effect === null) return null;

  return (
    <div className="resource-effect-layer" data-effect-id={effect.id} aria-hidden="true">
      {flights.map((flight) => (
        <span
          className={`resource-flight resource-flight-${flight.resource}`}
          data-resource-flight={`${flight.playerId}:${flight.resource}`}
          key={flight.id}
          style={flightStyle(flight)}
        >
          <span className="resource-flight-mark">{resourceMark(flight.resource)}</span>
          <strong>×{flight.amount}</strong>
        </span>
      ))}
      {flights.map((flight) => (
        <span className="resource-arrival-pop" key={`${flight.id}:arrival`} style={flightStyle(flight)}>
          +{flight.amount}
        </span>
      ))}
    </div>
  );
}

export function measureFlights(effect: PublicGameEffectView, root: ParentNode = document): readonly ResourceFlight[] {
  const flights: ResourceFlight[] = [];
  let index = 0;

  for (const grant of effect.grants) {
    for (const resource of RESOURCE_TYPES) {
      const amount = grant.resources[resource];
      if (amount <= 0) continue;
      const matchingSources = effect.sources.filter(
        (source) => source.playerId === grant.playerId && source.resource === resource,
      );
      const sourceElements = matchingSources
        .map((source) => findDataElement(root, "hex-id", source.hexId))
        .filter((element): element is Element => element !== null);
      const source = averageCenter(sourceElements) ?? centerOf(findDataElement(root, "board-root", "true"));
      const ownTarget = findDataElement(root, "resource-target", `${grant.playerId}:${resource}`);
      const target = centerOf(ownTarget ?? findDataElement(root, "player-target", grant.playerId));
      if (source === null || target === null) continue;
      const arc = Math.min(150, Math.max(58, Math.abs(target.x - source.x) * 0.16));
      const delay = index * 70;
      flights.push({
        id: `${effect.id}:${grant.playerId}:${resource}`,
        playerId: grant.playerId,
        resource,
        amount,
        startX: source.x,
        startY: source.y,
        midX: source.x + (target.x - source.x) * 0.52,
        midY: source.y + (target.y - source.y) * 0.52 - arc,
        endX: target.x,
        endY: target.y,
        delay,
      });
      index += 1;
    }
  }

  return flights;
}

function animateSources(effect: PublicGameEffectView, reducedMotion: boolean): void {
  const hexIds = new Set(effect.sources.map((source) => source.hexId));
  const vertexIds = new Set(effect.sources.map((source) => source.vertexId));
  for (const hexId of hexIds) {
    const hex = findDataElement(document, "hex-id", hexId);
    animateElement(hex?.querySelector("polygon") ?? null, [
      { filter: "brightness(1)", opacity: 1 },
      { filter: "brightness(1.42) drop-shadow(0 0 10px rgba(255,222,112,.95))", opacity: 1 },
      { filter: "brightness(1)", opacity: 1 },
    ], reducedMotion ? 260 : 720);
    animateElement(hex?.querySelector(".token") ?? null, [
      { transform: "scale(1)" },
      { transform: "scale(1.2)" },
      { transform: "scale(1)" },
    ], reducedMotion ? 240 : 620);
  }
  for (const vertexId of vertexIds) {
    const building = findDataElement(document, "vertex-id", vertexId);
    animateElement(building?.querySelector(".piece-building-body") ?? null, [
      { transform: "scale(1)" },
      { transform: "scale(1.18)" },
      { transform: "scale(1)" },
    ], reducedMotion ? 220 : 600);
  }
}

function animateTargets(effect: PublicGameEffectView, reducedMotion: boolean): void {
  for (const grant of effect.grants) {
    const targets = RESOURCE_TYPES
      .filter((resource) => grant.resources[resource] > 0)
      .map((resource) => findDataElement(document, "resource-target", `${grant.playerId}:${resource}`))
      .filter((element): element is Element => element !== null);
    if (targets.length === 0) {
      const playerTarget = findDataElement(document, "player-target", grant.playerId);
      if (playerTarget !== null) targets.push(playerTarget);
    }
    for (const target of targets) {
      animateElement(target, [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.08)", filter: "brightness(1.35) drop-shadow(0 0 9px rgba(255,215,97,.85))" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ], reducedMotion ? 240 : 460);
    }
  }
}

function animateFlightTarget(flight: ResourceFlight): void {
  const target = findDataElement(document, "resource-target", `${flight.playerId}:${flight.resource}`)
    ?? findDataElement(document, "player-target", flight.playerId);
  animateElement(target, [
    { transform: "scale(1)", filter: "brightness(1)" },
    { transform: "scale(1.08)", filter: "brightness(1.35) drop-shadow(0 0 9px rgba(255,215,97,.85))" },
    { transform: "scale(1)", filter: "brightness(1)" },
  ], 460);
}

function animateElement(element: Element | null, keyframes: Keyframe[], duration: number): void {
  if (element === null || typeof element.animate !== "function") return;
  element.animate(keyframes, { duration, easing: "cubic-bezier(.2,.8,.2,1)" });
}

function findDataElement(root: ParentNode, name: string, value: string): Element | null {
  return [...root.querySelectorAll(`[data-${name}]`)]
    .find((element) => element.getAttribute(`data-${name}`) === value) ?? null;
}

function averageCenter(elements: readonly Element[]): { readonly x: number; readonly y: number } | null {
  if (elements.length === 0) return null;
  const centers = elements.map(centerOf).filter((center): center is { x: number; y: number } => center !== null);
  if (centers.length === 0) return null;
  return {
    x: centers.reduce((sum, center) => sum + center.x, 0) / centers.length,
    y: centers.reduce((sum, center) => sum + center.y, 0) / centers.length,
  };
}

function centerOf(element: Element | null): { readonly x: number; readonly y: number } | null {
  if (element === null) return null;
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function flightStyle(flight: ResourceFlight): CSSProperties {
  return {
    "--flight-start-x": `${flight.startX}px`,
    "--flight-start-y": `${flight.startY}px`,
    "--flight-mid-x": `${flight.midX}px`,
    "--flight-mid-y": `${flight.midY}px`,
    "--flight-end-x": `${flight.endX}px`,
    "--flight-end-y": `${flight.endY}px`,
    "--flight-delay": `${flight.delay}ms`,
    "--arrival-delay": `${620 + flight.delay}ms`,
  } as CSSProperties;
}

function useReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}

function resourceMark(resource: Resource): string {
  return { brick: "▧", lumber: "♠", wool: "⌁", grain: "≋", ore: "◆" }[resource];
}
