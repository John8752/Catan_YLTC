import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Dices, Flag, Handshake, LockKeyhole, Ticket } from "lucide-react";
import type { CamelGameView } from "@catan/protocol/camel-up";
/** One local receipt travels to the wallet; only after the server accepts the action. */
export function ActionFlight({ effect, origin }: { effect: CamelGameView["effect"]; origin: DOMRect | null }) {
  const token = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = token.current, target = document.querySelector(effect?.type === "tile" || effect?.type === "finish-bet" ? "[data-testid=three-arena]" : "[data-camel-wallet]");
    if (!effect || !node || !origin || !target || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = target.getBoundingClientRect(), x = origin.x + origin.width / 2 - 22, y = origin.y + origin.height / 2 - 22;
    const dx = end.x + end.width / 2 - 22, dy = end.y + end.height / 2 - 22;
    const animation = node.animate([
      { opacity: 0, transform: `translate(${x}px,${y}px) scale(.7) rotate(-10deg)`, offset: 0 },
      { opacity: 1, transform: `translate(${x * .55 + dx * .45}px,${Math.min(y, dy) - 60}px) scale(1.12) rotate(6deg)`, offset: .45 },
      { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.15) rotate(0deg)`, offset: 1 },
    ], { duration: 740, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both" });
    return () => animation.cancel();
  }, [effect, origin]);
  if (!effect) return null;
  const Icon = ({ roll: Dices, ticket: Ticket, tile: Flag, "finish-bet": LockKeyhole, partner: Handshake })[effect.type];
  return createPortal(<div ref={token} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] grid size-11 place-items-center rounded-xl bg-[#e8bd69] text-[#365143] opacity-0 shadow-[inset_0_2px_0_#fff0c0,inset_0_-3px_0_#b18030,0_8px_15px_#173c3a30]"><Icon className="size-6" /></div>, document.body);
}
