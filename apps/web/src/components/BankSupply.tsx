import { RESOURCE_TYPES, type ResourceHand } from "@catan/game-core";
import { Landmark } from "lucide-react";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";
import { cn } from "@/lib/utils.js";

export function BankSupply({ resources, className, effectAnchor = true }: { readonly resources: ResourceHand | null; readonly className?: string; readonly effectAnchor?: boolean }) {
  return (
    <section
      className={cn("mr-auto flex min-w-0 items-center gap-1 rounded-lg border border-white/15 bg-[#173f42]/72 p-1 shadow-sm backdrop-blur-sm lg:gap-1.5 lg:rounded-xl lg:p-1.5", className)}
      aria-label="银行剩余资源"
      data-resource-source={effectAnchor ? "bank" : undefined}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#f2dfb3] text-[#6b5031] lg:size-10" title="银行">
        <Landmark className="size-5 lg:size-7" aria-hidden="true" />
      </span>
      <div className="grid min-w-0 grid-cols-5 gap-0.5 lg:flex-1 lg:gap-1">
        {RESOURCE_TYPES.map((resource) => (
          <ResourceCard
            key={resource}
            resource={resource}
            count={resources === null ? undefined : resources[resource]}
            variant="bank"
            ariaLabel={resources === null ? `银行${resourceLabel(resource)}，数量不公开` : `银行剩余${resourceLabel(resource)} ${resources[resource]} 张`}
          />
        ))}
      </div>
    </section>
  );
}
