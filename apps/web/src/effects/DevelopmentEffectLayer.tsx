import type { PublicGameEffectView } from "@catan/protocol";
import type { ResourceHand } from "@catan/game-core";
import { Gift, Magnet, Route, Shield } from "lucide-react";
import { useLayoutEffect, useMemo } from "react";
import { resourceLabel } from "@/components/ResourceCard.js";

type DevelopmentEffect = Extract<PublicGameEffectView, { readonly kind: "development-card-play" | "free-road-built" }>;

const DEVELOPMENT_EFFECT_DURATION_MS = 1_650;
const FREE_ROAD_EFFECT_DURATION_MS = 1_150;
const REDUCED_MOTION_DURATION_MS = 700;

export function isDevelopmentEffect(effect: PublicGameEffectView | null): effect is DevelopmentEffect {
  return effect?.kind === "development-card-play" || effect?.kind === "free-road-built";
}

export function DevelopmentEffectLayer({
  effect,
  currentPlayerId,
  playerName,
  onComplete,
}: {
  readonly effect: DevelopmentEffect | null;
  readonly currentPlayerId: string;
  readonly playerName: (playerId: string) => string;
  readonly onComplete: () => void;
}) {
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (effect === null) return;
    if (effect.kind === "free-road-built") animatePlacedRoad(effect.edgeId, reducedMotion);
    const duration = reducedMotion
      ? REDUCED_MOTION_DURATION_MS
      : effect.kind === "development-card-play"
        ? DEVELOPMENT_EFFECT_DURATION_MS
        : FREE_ROAD_EFFECT_DURATION_MS;
    const timer = window.setTimeout(onComplete, duration);
    return () => window.clearTimeout(timer);
  }, [effect, onComplete, reducedMotion]);

  if (effect === null) return null;
  const ownAction = effect.playerId === currentPlayerId;
  const copy = effectCopy(effect, ownAction, playerName(effect.playerId));
  const Icon = effectIcon(effect);

  return (
    <div className="pointer-events-none absolute inset-x-2 top-7 z-40 flex justify-center lg:top-12" aria-live="assertive">
      <div
        className={`development-effect-card${effect.kind === "free-road-built" ? " is-free-road" : ""} flex w-fit max-w-[min(92vw,30rem)] items-center gap-3 rounded-2xl border-2 border-[#f3d47f]/90 bg-[#163f3b]/96 px-3 py-2.5 text-[#fff8df] shadow-[0_14px_36px_rgba(4,24,23,.5),0_0_24px_rgba(245,205,98,.2)] backdrop-blur-sm lg:px-4`}
        data-development-effect={effect.kind === "development-card-play" ? effect.card.type : "free-road-built"}
        role="status"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#ffe59a]/65 bg-[#f3e4bd] text-[#8f4937] shadow-[inset_0_1px_rgba(255,255,255,.8)] lg:size-12">
          <Icon className="size-5 lg:size-6" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <strong className="block text-sm leading-tight font-black text-[#ffe89c] lg:text-base">{copy.title}</strong>
          <small className="mt-0.5 block text-xs leading-snug font-bold text-[#e7ddc5] lg:text-sm">{copy.detail}</small>
        </span>
      </div>
    </div>
  );
}

function effectCopy(effect: DevelopmentEffect, ownAction: boolean, name: string): { readonly title: string; readonly detail: string } {
  const actor = ownAction ? "你" : name;
  if (effect.kind === "free-road-built") {
    const progress = `${effect.placed}/${effect.total}`;
    return {
      title: `${actor}放置了免费道路`,
      detail: effect.completed ? `${progress} · 放置完成` : `${progress} · 继续选择下一条道路`,
    };
  }
  switch (effect.card.type) {
    case "knight":
      return {
        title: `${actor}使用了「骑士」`,
        detail: ownAction ? "请在棋盘上移动强盗" : `${name}正在移动强盗`,
      };
    case "road-building":
      return {
        title: `${actor}使用了「道路建设」`,
        detail: ownAction ? `可免费放置 ${effect.card.roadsGranted} 条道路` : `${name}正在选择免费道路`,
      };
    case "monopoly": {
      const result = effect.card.total === 0
        ? `垄断${resourceLabel(effect.card.resource)}，没有获得资源`
        : `垄断${resourceLabel(effect.card.resource)} · 共获得 ${effect.card.total} 张`;
      return {
        title: `${actor}使用了「垄断」`,
        detail: effect.card.ownLoss > 0
          ? `${result} · 你交出 ${effect.card.ownLoss} 张`
          : result,
      };
    }
    case "resource-choice":
      return {
        title: `${actor}使用了「丰收」`,
        detail: `从银行获得 ${formatResources(effect.card.resources)}`,
      };
  }
}

function effectIcon(effect: DevelopmentEffect) {
  if (effect.kind === "free-road-built") return Route;
  return {
    knight: Shield,
    "road-building": Route,
    monopoly: Magnet,
    "resource-choice": Gift,
  }[effect.card.type];
}

function formatResources(resources: ResourceHand): string {
  return (Object.entries(resources) as [keyof typeof resources, number][])
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => `${amount} 张${resourceLabel(resource)}`)
    .join("、");
}

function animatePlacedRoad(edgeId: string, reducedMotion: boolean): void {
  const target = [...document.querySelectorAll("[data-piece-location]")]
    .find((element) => element.getAttribute("data-piece-location") === edgeId);
  if (target === undefined || typeof target.animate !== "function") return;
  target.animate(
    reducedMotion
      ? [{ filter: "brightness(1)" }, { filter: "brightness(1.5)" }, { filter: "brightness(1)" }]
      : [
          { transform: "scale(.2)", transformOrigin: "center", opacity: 0, filter: "brightness(1.8)" },
          { transform: "scale(1.18)", transformOrigin: "center", opacity: 1, filter: "brightness(1.75) drop-shadow(0 0 10px #ffe48a)" },
          { transform: "scale(1)", transformOrigin: "center", opacity: 1, filter: "brightness(1)" },
        ],
    { duration: reducedMotion ? 260 : 720, easing: "cubic-bezier(.18,.82,.22,1)" },
  );
}

function useReducedMotion(): boolean {
  return useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
}
