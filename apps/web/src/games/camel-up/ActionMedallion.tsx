import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils.js";
const tones = {
  gold: "from-[#ffdfa0] to-[#d9a445] text-[#6e481b] shadow-[inset_0_1px_0_#fff0c1,inset_0_-2px_0_#b88636,0_2px_3px_#9e73252b]",
  jade: "from-[#9fd5af] to-[#4b917d] text-[#174f47] shadow-[inset_0_1px_0_#d0efd5,inset_0_-2px_0_#327864,0_2px_3px_#2861502b]",
  clay: "from-[#f3bc94] to-[#cd7d58] text-[#703921] shadow-[inset_0_1px_0_#ffddba,inset_0_-2px_0_#a66040,0_2px_3px_#8542292b]",
};
export function ActionMedallion({ Icon, tone = "gold", className }: { Icon: LucideIcon; tone?: keyof typeof tones; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-grid size-7 shrink-0 place-items-center rounded-lg bg-linear-to-b", tones[tone], className)}><Icon className="size-4!" strokeWidth={1.9} /></span>;
}
