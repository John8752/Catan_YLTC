import { useEffect, useSyncExternalStore } from "react";
import type { Camel } from "@catan/game-core/camel-up";
let portraits: Partial<Record<Camel, string>> = {};
let started = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useCamelPortrait(camel: Camel) {
  const images = useSyncExternalStore(subscribe, () => portraits);
  useEffect(() => { if (!started) { started = true; void import("./three/portraits.js").then(m => { portraits = m.renderPortraits(); for (const listener of listeners) listener(); }).catch(() => { /* Flat pictograms preserve all controls on devices without WebGL. */ }); } }, []);
  return images[camel];
}
