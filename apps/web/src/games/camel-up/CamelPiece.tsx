import { useCamelPortrait } from "./portrait-store.js";
import { cn } from "../../lib/utils.js";
import type { Camel } from "@catan/game-core/camel-up";
import { CAMEL_SVG_PATH } from "./camel-silhouette.js";
import { CAMEL_COLORS } from "./palette.js";
/** Original flat game-piece pictogram, used at the same scale for all camels. */
export function CamelShape({ camel }: { camel: Camel }) {
  return <g transform="scale(31 -31)" fill={CAMEL_COLORS[camel]} stroke={camel === "white" ? "#8c7147" : "#172e30"} strokeWidth=".035" strokeLinejoin="round"><path d={CAMEL_SVG_PATH} /></g>;
}
export function CamelPiece({ camel, className = "size-9" }: { camel: Camel; className?: string }) {
  const portrait = useCamelPortrait(camel);
  return <span aria-hidden="true" className={cn("inline-grid shrink-0 place-items-center overflow-visible", className)}>{portrait ? <img src={portrait} alt="" width="128" height="128" className="h-full w-full object-contain drop-shadow-[0_2px_1px_#183b392b]" /> : <svg viewBox="-36 -47 76 58" className="h-full w-full"><CamelShape camel={camel} /></svg>}</span>;
}
