import { cn } from "../../lib/utils.js";
export function Chip({ className, gold = false }: { className?: string; gold?: boolean }) {
  return <svg viewBox="0 0 32 32" className={cn("size-4 shrink-0", className)} aria-hidden="true"><circle cx="16" cy="17" r="14" fill="#071b17" /><circle cx="16" cy="15" r="13" fill={gold ? "#d6ae65" : "#59cab1"} stroke={gold ? "#ffe4a4" : "#b4f6df"} strokeWidth="2" strokeDasharray="5 5" /><circle cx="16" cy="15" r="8" fill={gold ? "#846033" : "#268b74"} stroke={gold ? "#f4d394" : "#92e3c9"} /><path d="m16 10 4 5-4 5-4-5Z" fill={gold ? "#f4d394" : "#b5f4df"} /></svg>;
}
