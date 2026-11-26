import { useEffect, useRef, useState } from "react";
import type { GameType } from "@catan/protocol/platform";
import { getGameDefinition } from "@catan/protocol/platform";
import { PRESENTATIONS } from "./presentation.js";
import { cn } from "../../lib/utils.js";

/** One renderer for the selected game. Scene loading never blocks room controls. */
export function WorldPreview({ gameId, seated = 0, capacity = 0, className }: { gameId: GameType; seated?: number; capacity?: number; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const update = useRef<((id: GameType, seated: number, capacity: number) => void) | null>(null);
  const current = useRef({ gameId, seated, capacity });
  current.current = { gameId, seated, capacity };
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let active = true, dispose: (() => void) | undefined;
    void import("./world-scene.js").then(({ createWorld }) => {
      if (!active) return;
      const scene = createWorld(container, current.current, () => active && setStatus("fallback"));
      dispose = scene.dispose;
      update.current = scene.update;
      if (active) setStatus("ready");
    }).catch(() => active && setStatus("fallback"));
    return () => { active = false; update.current = null; dispose?.(); };
  }, []);
  useEffect(() => update.current?.(gameId, seated, capacity), [gameId, seated, capacity]);
  const { icon: Icon, accent } = PRESENTATIONS[gameId];
  return <div className={cn("relative isolate min-h-0 w-full", className)} data-world={gameId} data-world-status={status}>
    <div ref={root} className={cn("absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none", status === "fallback" && "invisible")} role="img" aria-label={`${getGameDefinition(gameId).name} 3D 微缩展台`} />
    {status !== "ready" && <div className="absolute inset-0 grid place-content-center justify-items-center gap-4" role="img" aria-label={`${getGameDefinition(gameId).name} 静态展台`}>
      <div className="grid size-28 rotate-[-12deg] place-items-center rounded-[28px] bg-[#e9d6ac] text-[#254a43] shadow-[10px_20px_40px_#051d2455] sm:size-40"><Icon className="size-16 sm:size-24" strokeWidth={1.1} /></div>
      <p className="mt-4 text-sm" style={{ color: accent }}>{status === "loading" ? "正在摆好桌面…" : "桌面已就绪，随时可以开桌"}</p>
    </div>}
  </div>;
}
