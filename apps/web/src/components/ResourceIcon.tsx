import type { ResourceType } from "@catan/game-core";

export type ResourceIconKind = ResourceType | "desert" | "unknown";

export function ResourceIcon({
  kind,
  className,
  transform,
  context,
}: {
  readonly kind: ResourceIconKind;
  readonly className?: string;
  readonly transform?: string;
  readonly context?: "tile" | "port" | "card" | "analysis";
}) {
  return (
    <g
      className={["resource-icon", `resource-icon-${kind}`, className].filter(Boolean).join(" ")}
      transform={transform}
      data-resource-icon={kind}
      data-tile-resource-icon={context === "tile" ? kind : undefined}
      data-port-resource-icon={context === "port" ? kind : undefined}
      aria-hidden="true"
    >
      {iconShape(kind, context !== "port")}
    </g>
  );
}

function iconShape(kind: ResourceIconKind, showUnknownRing: boolean) {
  switch (kind) {
    case "brick":
      return (
        <>
          <rect className="resource-icon-primary" x="-17" y="-10" width="15" height="8" rx="2" />
          <rect className="resource-icon-secondary" x="0" y="-10" width="17" height="8" rx="2" />
          <rect className="resource-icon-secondary" x="-13" y="0" width="17" height="8" rx="2" />
          <rect className="resource-icon-primary" x="6" y="0" width="13" height="8" rx="2" />
          <path className="resource-icon-line" d="M-18 11H18" />
        </>
      );
    case "lumber":
      return (
        <>
          <path className="resource-icon-secondary" d="M-16 7L-9-3H-13L-6-14L1-3H-3L4 7Z" />
          <path className="resource-icon-primary" d="M-5 8L4-5H0L8-18L16-5H12L20 8Z" />
          <path className="resource-icon-line" d="M-6 7V14M8 7V15" />
        </>
      );
    case "wool":
      return (
        <>
          <path
            className="resource-icon-primary"
            d="M-16 2C-19-3-15-8-11-9C-10-14-4-15 0-11C4-15 11-12 11-8C16-8 19-3 16 2C18 7 13 11 9 10C5 14-6 14-10 10C-15 11-19 7-16 2Z"
          />
          <path className="resource-icon-secondary" d="M-6-3L-14-7L-11 1ZM6-3L14-7L11 1ZM-7-3Q0-8 7-3L6 6Q0 12-6 6Z" />
          <circle className="resource-icon-highlight" cx="-2.5" cy="1" r="1" />
          <circle className="resource-icon-highlight" cx="2.5" cy="1" r="1" />
          <path className="resource-icon-highlight-line" d="M-1 5L0 6L1 5" />
        </>
      );
    case "grain":
      return (
        <>
          <path className="resource-icon-line" d="M0 15V-16M0 7L-9-2M0 2L9-7M0-5L-7-12" />
          <ellipse className="resource-icon-primary" cx="-9" cy="-4" rx="4" ry="7" transform="rotate(-48 -9 -4)" />
          <ellipse className="resource-icon-secondary" cx="9" cy="-9" rx="4" ry="7" transform="rotate(48 9 -9)" />
          <ellipse className="resource-icon-primary" cx="-7" cy="-14" rx="3.8" ry="6" transform="rotate(-42 -7 -14)" />
          <ellipse className="resource-icon-secondary" cx="5" cy="3" rx="3.5" ry="6" transform="rotate(42 5 3)" />
        </>
      );
    case "ore":
      return (
        <>
          <path className="resource-icon-secondary" d="M-19 9L-14-5L-5-12L2-3L-1 11Z" />
          <path className="resource-icon-primary" d="M-5 11L0-7L10-15L19-3L15 11Z" />
          <path className="resource-icon-highlight-line" d="M4-5L10-10L14-4M-13-3L-8-7" />
        </>
      );
    case "desert":
      return (
        <>
          <circle className="resource-icon-secondary" cx="9" cy="-10" r="5" />
          <path className="resource-icon-line" d="M9-19V-17M9-3V-1M0-10H2M16-10H18M3-16L5-14M13-6L15-4" />
          <path className="resource-icon-primary" d="M-20 10Q-10-4 1 8Q10-1 21 9V15H-20Z" />
          <path className="resource-icon-highlight-line" d="M-17 11Q-9 4-1 10Q8 4 17 10" />
        </>
      );
    case "unknown":
      return (
        <>
          {showUnknownRing ? <circle className="resource-icon-primary" r="15" /> : null}
          <path className="resource-icon-line" d="M-5-5Q-5-12 2-12Q9-12 9-5Q9-1 3 2Q0 4 0 8M0 13V14" />
        </>
      );
  }
}
