import type { ResourceType } from "@catan/game-core";
import { cn } from "@/lib/utils.js";
import { ResourceIcon } from "./ResourceIcon.js";

export type ResourceCardKind = ResourceType | "unknown";

export const RESOURCE_PRESENTATION = {
  brick: { label: "砖", mark: "▧", className: "from-[#bd6049] to-[#8f3f30]" },
  lumber: { label: "木", mark: "♠", className: "from-[#4f9162] to-[#28603e]" },
  wool: { label: "羊", mark: "⌁", className: "from-[#9ab77c] to-[#66864f]" },
  grain: { label: "麦", mark: "≋", className: "from-[#dfb64c] to-[#ad7d20]" },
  ore: { label: "矿", mark: "◆", className: "from-[#84949a] to-[#53646b]" },
  unknown: { label: "未知", mark: "?", className: "from-[#3378a8] to-[#174f7d]" },
} as const;

export function ResourceCard({
  resource,
  count,
  selectedCount = 0,
  variant = "hand",
  disabled = false,
  pressed,
  ariaLabel,
  className,
  targetId,
  onClick,
}: {
  readonly resource: ResourceCardKind;
  readonly count?: number | undefined;
  readonly selectedCount?: number;
  readonly variant?: "hand" | "compact" | "flight";
  readonly disabled?: boolean;
  readonly pressed?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly targetId?: string | undefined;
  readonly onClick?: (() => void) | undefined;
}) {
  const presentation = RESOURCE_PRESENTATION[resource];
  const interactive = onClick !== undefined;
  const cardClassName = cn(
    "group/resource-card relative isolate grid min-w-0 overflow-hidden rounded-lg border border-white/65 bg-gradient-to-b text-left text-white shadow-[0_4px_9px_rgba(25,37,34,.24),inset_0_1px_rgba(255,255,255,.35)] transition",
    variant === "hand" && "min-h-16 px-2.5 py-2",
    variant === "compact" && "h-14 w-11 px-1.5 py-1.5",
    variant === "flight" && "h-[4.25rem] w-[3.35rem] px-1.5 py-1.5 shadow-[0_9px_18px_rgba(9,31,29,.38),inset_0_1px_rgba(255,255,255,.4)]",
    interactive && !disabled && "cursor-pointer hover:-translate-y-0.5 hover:brightness-110 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff1a8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3e6c8] active:translate-y-0",
    pressed === true && "ring-2 ring-[#fff1a8] ring-offset-2 ring-offset-[#7a5b35] brightness-110",
    disabled && "cursor-not-allowed saturate-[.45] opacity-45",
    presentation.className,
    className,
  );
  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-px bg-white/55" aria-hidden="true" />
      <svg
        className={cn("resource-card-icon", variant === "hand" ? "size-7" : "size-5")}
        viewBox="-22 -22 44 44"
        aria-hidden="true"
      >
        <ResourceIcon kind={resource} context="card" />
      </svg>
      <span className={cn("mt-auto font-black tracking-wide", variant === "hand" ? "text-[11px] lg:text-xs" : "text-[9px] lg:text-xs")}>
        {presentation.label}
      </span>
      {count === undefined ? null : (
        <strong className={cn("absolute top-1 right-1 grid min-w-6 place-items-center rounded-md bg-[#154c78] px-1 leading-6 shadow-sm", variant === "hand" ? "text-base" : "text-xs")}>
          {count}
        </strong>
      )}
      {selectedCount <= 0 ? null : (
        <span className="absolute right-1 bottom-1 rounded bg-[#fff5ce] px-1 py-0.5 text-[9px] font-black text-[#75452f] shadow-sm">
          已选 {selectedCount}
        </span>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={cardClassName}
        disabled={disabled}
        aria-pressed={pressed}
        aria-label={ariaLabel}
        data-resource-target={targetId}
        data-resource-card={resource}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cardClassName} aria-label={ariaLabel} data-resource-target={targetId} data-resource-card={resource}>
      {content}
    </div>
  );
}

export function resourceLabel(resource: ResourceCardKind): string {
  return RESOURCE_PRESENTATION[resource].label;
}

export function resourceMark(resource: ResourceCardKind): string {
  return RESOURCE_PRESENTATION[resource].mark;
}
