import { RESOURCE_TYPES, type ResourceHand } from "@catan/game-core";
import { Landmark } from "lucide-react";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";

import { cn } from "@/lib/utils.js";

export function BankSupply({ resources, className }: { readonly resources: ResourceHand; readonly className?: string }) {
  return (
    <section
      className={cn("mr-auto flex min-w-0 items-center gap-1 rounded-lg border border-white/15 bg-[#173f42]/72 p-1 shadow-sm backdrop-blur-sm lg:gap-1.5 lg:rounded-xl lg:p-1.5", className)}
      aria-label="银行剩余资源"
      data-resource-source="bank"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#f2dfb3] text-[#6b5031] lg:size-9" title="银行">
        <Landmark className="size-4 lg:size-5" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 gap-0.5 lg:gap-1">
        {RESOURCE_TYPES.map((resource) => (
          <ResourceCard
            key={resource}
            resource={resource}
            count={resources[resource]}
            variant="compact"
            className="h-10 w-8 rounded-md px-1 py-1 lg:h-12 lg:w-9 [&>strong]:min-w-4 [&>strong]:px-0.5 [&>strong]:text-[10px] [&>strong]:leading-4"
            ariaLabel={`银行剩余${resourceLabel(resource)} ${resources[resource]} 张`}
          />
        ))}
      </div>
    </section>
  );
}
