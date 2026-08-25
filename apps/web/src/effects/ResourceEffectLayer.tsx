import { RESOURCE_TYPES } from "@catan/game-core";
import type { PublicGameEffectView } from "@catan/protocol";
import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import { ResourceCard, type ResourceCardKind } from "@/components/ResourceCard.js";

interface ResourceFlight {
  readonly id: string;
  readonly playerId: string;
  readonly resource: ResourceCardKind;
  readonly amount: number;
  readonly startX: number;
  readonly startY: number;
  readonly midX: number;
  readonly midY: number;
  readonly endX: number;
  readonly endY: number;
  readonly delay: number;
  readonly direction: "gain" | "spend";
}

interface RobberMotion {
  readonly startX: number;
  readonly startY: number;
  readonly midX: number;
  readonly midY: number;
  readonly endX: number;
  readonly endY: number;
}

export function ResourceEffectLayer({
  effect,
  onComplete,
  playerName,
}: {
  readonly effect: PublicGameEffectView | null;
  readonly onComplete: () => void;
  readonly playerName?: (playerId: string) => string;
}) {
  const [flights, setFlights] = useState<readonly ResourceFlight[]>([]);
  const [robberMotion, setRobberMotion] = useState<RobberMotion | null>(null);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (effect === null) {
      setFlights([]);
      setRobberMotion(null);
      return;
    }

    const nextFlights = reducedMotion ? [] : measureFlights(effect);
    const nextRobberMotion = !reducedMotion && effect.kind === "robber-move" ? measureRobberMove(effect) : null;
    setFlights(nextFlights);
    setRobberMotion(nextRobberMotion);
    animateSources(effect, reducedMotion);

    if (effect.kind === "robber-move") {
      const settledRobber = findDataElement(document, "robber-piece", "true") as SVGElement | null;
      if (settledRobber !== null && nextRobberMotion !== null) settledRobber.style.opacity = "0";
      const revealTimer = window.setTimeout(() => {
        if (settledRobber !== null) settledRobber.style.opacity = "";
        animateTargets(effect, reducedMotion);
      }, reducedMotion ? 40 : 1_900);
      const completionTimer = window.setTimeout(onComplete, reducedMotion ? 320 : 2_180);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(completionTimer);
        if (settledRobber !== null) settledRobber.style.opacity = "";
      };
    }

    if (effect.kind === "score-change") {
      animateTargets(effect, reducedMotion);
      const completionTimer = window.setTimeout(onComplete, reducedMotion ? 360 : 1_850);
      return () => window.clearTimeout(completionTimer);
    }

    const arrivalTimers = reducedMotion
      ? [window.setTimeout(() => animateTargets(effect, true), 40)]
      : effect.kind === "resource-spend"
        ? [window.setTimeout(() => animateTargets(effect, false), 1_900 + longestFlightDelay(nextFlights))]
      : nextFlights.length === 0
        ? [window.setTimeout(() => animateTargets(effect, false), 1_900)]
        : nextFlights.map((flight) => window.setTimeout(() => animateFlightTarget(flight), 1_900 + flight.delay));
    const longestDelay = longestFlightDelay(nextFlights);
    const completionTimer = window.setTimeout(onComplete, reducedMotion ? 320 : 2_450 + longestDelay);
    return () => {
      for (const timer of arrivalTimers) window.clearTimeout(timer);
      window.clearTimeout(completionTimer);
    };
  }, [effect, onComplete, reducedMotion]);

  if (effect === null) return null;

  return (
    <div className="resource-effect-layer" data-effect-id={effect.id}>
      {flights.map((flight) => (
        <span
          className={`resource-flight is-${flight.direction}`}
          data-resource-flight={`${flight.playerId}:${flight.resource}`}
          key={flight.id}
          style={flightStyle(flight)}
          aria-hidden="true"
        >
          <ResourceCard resource={flight.resource} count={flight.amount} variant="flight" />
        </span>
      ))}
      {flights.map((flight) => (
        <span className={`resource-arrival-pop is-${flight.direction}`} key={`${flight.id}:arrival`} style={flightStyle(flight)} aria-hidden="true">
          {flight.direction === "gain" ? "+" : "−"}{flight.amount}
        </span>
      ))}
      {effect.kind !== "score-change" ? null : (
        <div className="score-effect" role="status" data-score-effect={effect.reason}>
          <span>{playerName?.(effect.playerId) ?? "玩家"}</span>
          <strong>+{effect.delta} 分</strong>
          <small>{scoreReasonLabel(effect.reason)}</small>
        </div>
      )}
      {robberMotion === null ? null : (
        <span className="robber-flight" style={robberStyle(robberMotion)} aria-hidden="true">
          <span className="robber-flight-head" />
          <span className="robber-flight-body" />
        </span>
      )}
    </div>
  );
}

function longestFlightDelay(flights: readonly ResourceFlight[]): number {
  return flights.reduce((maximum, flight) => Math.max(maximum, flight.delay), 0);
}

export function measureFlights(effect: PublicGameEffectView, root: ParentNode = document): readonly ResourceFlight[] {
  const flights: ResourceFlight[] = [];
  let index = 0;

  if (effect.kind === "resource-transfer") {
    for (const transfer of effect.transfers) {
      const resource = transfer.resource ?? "unknown";
      const source = centerOf(findDataElement(root, "player-target", transfer.sourcePlayerId))
        ?? centerOf(findDataElement(root, "board-root", "true"));
      const knownTarget = transfer.resource === null
        ? null
        : findDataElement(root, "resource-target", `${transfer.playerId}:${transfer.resource}`);
      const target = centerOf(knownTarget ?? findDataElement(root, "player-target", transfer.playerId));
      if (source === null || target === null) continue;
      flights.push(createFlight({
        id: `${effect.id}:${transfer.playerId}:${resource}`,
        playerId: transfer.playerId,
        resource,
        amount: transfer.amount,
        source,
        target,
        delay: index * 70,
        direction: "gain",
      }));
      index += 1;
    }
    return flights;
  }

  if (effect.kind === "resource-spend") {
    const destination = effect.destination.kind === "build"
      ? findDataElement(root, "piece-location", effect.destination.locationId)
      : findDataElement(root, "resource-sink", "development");
    const target = centerOf(destination) ?? centerOf(findDataElement(root, "board-root", "true"));
    if (target === null) return [];
    for (const resource of RESOURCE_TYPES) {
      const amount = effect.resources[resource];
      if (amount <= 0) continue;
      const source = centerOf(findDataElement(root, "resource-target", `${effect.playerId}:${resource}`))
        ?? centerOf(findDataElement(root, "player-target", effect.playerId));
      if (source === null) continue;
      flights.push(createFlight({
        id: `${effect.id}:${effect.playerId}:${resource}`,
        playerId: effect.playerId,
        resource,
        amount,
        source,
        target,
        delay: index * 70,
        direction: "spend",
      }));
      index += 1;
    }
    return flights;
  }

  if (effect.kind !== "resource-grant") return flights;

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
      const source = averageCenter(sourceElements)
        ?? centerOf(grant.origin?.kind === "player"
          ? findDataElement(root, "player-target", grant.origin.playerId)
          : grant.origin?.kind === "bank"
            ? findDataElement(root, "resource-source", "bank")
            : null)
        ?? centerOf(findDataElement(root, "board-root", "true"));
      const ownTarget = findDataElement(root, "resource-target", `${grant.playerId}:${resource}`);
      const target = centerOf(ownTarget ?? findDataElement(root, "player-target", grant.playerId));
      if (source === null || target === null) continue;
      const delay = index * 70;
      flights.push(createFlight({
        id: `${effect.id}:${grant.playerId}:${resource}`,
        playerId: grant.playerId,
        resource,
        amount,
        source,
        target,
        delay,
        direction: "gain",
      }));
      index += 1;
    }
  }

  return flights;
}

function animateSources(effect: PublicGameEffectView, reducedMotion: boolean): void {
  if (effect.kind === "resource-transfer") {
    for (const sourcePlayerId of new Set(effect.transfers.map((transfer) => transfer.sourcePlayerId))) {
      animateElement(findDataElement(document, "player-target", sourcePlayerId), [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(.96)", filter: "brightness(.78)" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ], reducedMotion ? 220 : 520);
    }
    return;
  }
  if (effect.kind === "resource-spend") {
    for (const resource of RESOURCE_TYPES.filter((candidate) => effect.resources[candidate] > 0)) {
      const source = findDataElement(document, "resource-target", `${effect.playerId}:${resource}`)
        ?? findDataElement(document, "player-target", effect.playerId);
      animateElement(source, [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(.94)", filter: "brightness(.72) saturate(.72)" },
        { transform: "scale(1)", filter: "brightness(1)" },
      ], reducedMotion ? 220 : 620);
    }
    return;
  }
  if (effect.kind !== "resource-grant") return;
  const hexIds = new Set(effect.triggeredHexIds);
  const vertexIds = new Set(effect.sources.map((source) => source.vertexId));
  for (const hexId of hexIds) {
    const hex = findDataElement(document, "hex-id", hexId);
    animateElement(
      hex?.querySelector(".hex-content") ?? null,
      reducedMotion
        ? [
            { filter: "brightness(1)" },
            { filter: "brightness(1.28) drop-shadow(0 0 7px rgba(255,222,112,.8))" },
            { filter: "brightness(1)" },
          ]
        : [
            { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
            { transform: "translateX(-3px) scale(1.025)", filter: "brightness(1.34) drop-shadow(0 0 9px rgba(255,222,112,.9))" },
            { transform: "translateX(4px) scale(1.035)", filter: "brightness(1.42) drop-shadow(0 0 11px rgba(255,222,112,.95))" },
            { transform: "translateX(-2px) scale(1.03)", filter: "brightness(1.36) drop-shadow(0 0 9px rgba(255,222,112,.88))" },
            { transform: "translateX(2px) scale(1.018)", filter: "brightness(1.2)" },
            { transform: "translateX(0) scale(1)", filter: "brightness(1)" },
          ],
      reducedMotion ? 280 : 900,
    );
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
  const targets = effect.kind === "resource-grant"
    ? effect.grants.flatMap((grant) => RESOURCE_TYPES
      .filter((resource) => grant.resources[resource] > 0)
      .map((resource) => findDataElement(document, "resource-target", `${grant.playerId}:${resource}`) ?? findDataElement(document, "player-target", grant.playerId)))
    : effect.kind === "resource-transfer"
      ? effect.transfers.map((transfer) => transfer.resource === null
        ? findDataElement(document, "player-target", transfer.playerId)
        : findDataElement(document, "resource-target", `${transfer.playerId}:${transfer.resource}`) ?? findDataElement(document, "player-target", transfer.playerId))
      : effect.kind === "resource-spend"
        ? [effect.destination.kind === "build"
            ? findDataElement(document, "piece-location", effect.destination.locationId)
            : findDataElement(document, "resource-sink", "development")]
        : effect.kind === "score-change"
          ? [findDataElement(document, "player-target", effect.playerId)]
          : [findDataElement(document, "robber-piece", "true")];
  for (const target of targets.filter((element): element is Element => element !== null)) {
    animateElement(target, [
      { transform: "scale(1)", filter: "brightness(1)" },
      { transform: "scale(1.08)", filter: "brightness(1.35) drop-shadow(0 0 9px rgba(255,215,97,.85))" },
      { transform: "scale(1)", filter: "brightness(1)" },
    ], reducedMotion ? 240 : 460);
  }
}

function createFlight({ id, playerId, resource, amount, source, target, delay, direction }: {
  readonly id: string;
  readonly playerId: string;
  readonly resource: ResourceCardKind;
  readonly amount: number;
  readonly source: { readonly x: number; readonly y: number };
  readonly target: { readonly x: number; readonly y: number };
  readonly delay: number;
  readonly direction: "gain" | "spend";
}): ResourceFlight {
  const arc = Math.min(150, Math.max(58, Math.abs(target.x - source.x) * 0.16));
  return {
    id,
    playerId,
    resource,
    amount,
    startX: source.x,
    startY: source.y,
    midX: source.x + (target.x - source.x) * 0.52,
    midY: source.y + (target.y - source.y) * 0.52 - arc,
    endX: target.x,
    endY: target.y,
    delay,
    direction,
  };
}

function animateFlightTarget(flight: ResourceFlight): void {
  const target = (flight.resource === "unknown" ? null : findDataElement(document, "resource-target", `${flight.playerId}:${flight.resource}`))
    ?? findDataElement(document, "player-target", flight.playerId);
  animateElement(target, [
    { transform: "scale(1)", filter: "brightness(1)" },
    { transform: "scale(1.08)", filter: "brightness(1.35) drop-shadow(0 0 9px rgba(255,215,97,.85))" },
    { transform: "scale(1)", filter: "brightness(1)" },
  ], 560);
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
    "--arrival-delay": `${1_900 + flight.delay}ms`,
  } as CSSProperties;
}

export function measureRobberMove(
  effect: Extract<PublicGameEffectView, { readonly kind: "robber-move" }>,
  root: ParentNode = document,
): RobberMotion | null {
  const start = centerOf(findDataElement(root, "hex-id", effect.fromHexId));
  const end = centerOf(findDataElement(root, "hex-id", effect.toHexId));
  if (start === null || end === null) return null;
  return {
    startX: start.x,
    startY: start.y,
    midX: start.x + (end.x - start.x) * .5,
    midY: start.y + (end.y - start.y) * .5 - 46,
    endX: end.x,
    endY: end.y,
  };
}

function robberStyle(motion: RobberMotion): CSSProperties {
  return {
    "--robber-start-x": `${motion.startX}px`,
    "--robber-start-y": `${motion.startY}px`,
    "--robber-mid-x": `${motion.midX}px`,
    "--robber-mid-y": `${motion.midY}px`,
    "--robber-end-x": `${motion.endX}px`,
    "--robber-end-y": `${motion.endY}px`,
  } as CSSProperties;
}

function scoreReasonLabel(reason: Extract<PublicGameEffectView, { readonly kind: "score-change" }>["reason"]): string {
  return {
    settlement: "新村庄落成",
    city: "村庄升级为城市",
    "longest-road": "获得最长道路",
    "largest-army": "获得最大骑士力",
    "victory-point": "暗藏胜利点",
  }[reason];
}

function useReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}
