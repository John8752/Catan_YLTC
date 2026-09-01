import type { ReactNode } from "react";

/** The private dock stays mounted here, even when CSS places it below the map. */
export function GameSidebar({ bankSupply, roomControls, children, onInfoMount }: {
  readonly bankSupply?: ReactNode;
  readonly roomControls?: ReactNode;
  readonly children: ReactNode;
  readonly onInfoMount?: (element: HTMLDivElement | null) => void;
}) {
  // Desktop-only inherited colors keep compact controls and portaled dialogs on their light surfaces.
  return (
    <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:min-w-0 lg:flex-col lg:gap-1.5 lg:rounded-xl lg:bg-[var(--game-rail-bg)] lg:ring-1 lg:ring-inset lg:ring-[var(--game-rail-line)] lg:[--sidebar-ink:var(--game-rail-ink)] lg:[--sidebar-muted:var(--game-rail-muted)] lg:[--sidebar-line:var(--game-rail-line)] lg:[--sidebar-soft:var(--game-rail-soft)] lg:[--sidebar-control:var(--game-rail-control)] lg:[--sidebar-accent:var(--game-rail-accent)] xl:col-start-3 xl:row-span-1" data-game-sidebar="true">
      {roomControls}
      {bankSupply}
      <div ref={onInfoMount} className="hidden shrink-0 border border-transparent border-t-[var(--game-rail-line)] p-1.5 text-[var(--game-rail-ink)] [--phase-chip-ink:var(--game-rail-muted)] [--phase-chip-line:var(--game-rail-line)] lg:block" data-board-info-host="true" />
      {children}
    </div>
  );
}
