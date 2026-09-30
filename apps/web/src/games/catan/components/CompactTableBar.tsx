import type { GameView } from "@catan/protocol/catan";
import type { ReactNode } from "react";

/**
 * The phone header row: live bank stock beside the persistent table controls.
 * Turn order lives in the seat strip, so this row carries no queue of its own.
 */
export function CompactTableBar({ game, bank, actions }: {
  readonly game: GameView;
  readonly bank: ReactNode;
  readonly actions: ReactNode;
}) {
  const setup = game.phase.kind === "setup" ? game.phase : null;
  return (
    <section
      className="flex min-w-0 shrink-0 items-center gap-1 rounded-xl border border-[#f0c56b]/35 bg-[#102f31]/94 py-0.5 pr-0.5 pl-1 shadow-[0_5px_16px_rgba(6,31,32,.2)]"
      aria-label="银行与菜单"
      data-compact-table-bar="true"
    >
      {bank}
      {setup === null ? null : (
        <span className="shrink-0 px-1 text-xs font-bold whitespace-nowrap text-[#fff4d6]" data-setup-progress="true">
          摆放 {setup.placementIndex + 1}/{setup.placementOrder.length}
        </span>
      )}
      {actions}
    </section>
  );
}
