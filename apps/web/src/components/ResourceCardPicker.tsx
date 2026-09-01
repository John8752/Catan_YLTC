import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "@catan/game-core";
import { Badge } from "@/components/ui/badge.js";
import { ResourceCard, resourceLabel } from "./ResourceCard.js";

export function ResourceCardPalette({
  label,
  value,
  onChange,
  maximums,
  counts,
  compact = false,
}: {
  readonly label: string;
  readonly value: ResourceHand;
  readonly onChange: (value: ResourceHand) => void;
  readonly maximums?: ResourceHand | undefined;
  readonly counts?: ResourceHand | undefined;
  readonly compact?: boolean;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
      {RESOURCE_TYPES.map((resource) => {
        const maximum = maximums?.[resource] ?? Number.MAX_SAFE_INTEGER;
        const disabled = value[resource] >= maximum;
        return (
          <ResourceCard
            key={resource}
            resource={resource}
            variant={compact ? "compact" : "hand"}
            count={counts?.[resource]}
            selectedCount={value[resource]}
            disabled={disabled}
            ariaLabel={`在${label}中加入 1 张${resourceLabel(resource)}${counts === undefined ? "" : `，持有 ${counts[resource]} 张，已选 ${value[resource]} 张`}`}
            onClick={() => onChange(incrementResource(value, resource, maximum))}
          />
        );
      })}
    </div>
  );
}

export function SelectedResourceCards({
  label,
  value,
  onChange,
  emptyLabel = "尚未选择资源",
}: {
  readonly label: string;
  readonly value: ResourceHand;
  readonly onChange?: ((value: ResourceHand) => void) | undefined;
  readonly emptyLabel?: string;
}) {
  const resources = RESOURCE_TYPES.filter((resource) => value[resource] > 0);
  if (resources.length === 0) {
    return (
      <div className="flex min-h-16 items-center justify-center rounded-xl border border-dashed border-[var(--sidebar-line,#6d543440)] bg-[var(--sidebar-soft,#ffffff40)] px-3">
        <Badge variant="outline" className="border-0 bg-transparent text-[var(--sidebar-muted,#766d60)]">{emptyLabel}</Badge>
      </div>
    );
  }

  return (
    <div className="flex min-h-16 flex-wrap items-center justify-center gap-2" role="group" aria-label={label}>
      {resources.map((resource) => (
        <ResourceCard
          key={resource}
          resource={resource}
          variant="compact"
          count={value[resource]}
          ariaLabel={onChange === undefined ? `${value[resource]} 张${resourceLabel(resource)}` : `从${label}移除 1 张${resourceLabel(resource)}，当前 ${value[resource]} 张`}
          onClick={onChange === undefined ? undefined : () => onChange(decrementResource(value, resource))}
        />
      ))}
    </div>
  );
}

export function incrementResource(hand: ResourceHand, resource: ResourceType, maximum = Number.MAX_SAFE_INTEGER): ResourceHand {
  return { ...hand, [resource]: Math.min(maximum, hand[resource] + 1) };
}

export function decrementResource(hand: ResourceHand, resource: ResourceType): ResourceHand {
  return { ...hand, [resource]: Math.max(0, hand[resource] - 1) };
}

export function emptyResourceSelection(): ResourceHand {
  return emptyResourceHand();
}
