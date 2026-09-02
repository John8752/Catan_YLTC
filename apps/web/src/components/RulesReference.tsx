import { BUILD_COSTS } from "@catan/game-core";
import type { GameView } from "@catan/protocol";
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";

type CardType = GameView["you"]["developmentCards"][number]["type"];

/**
 * Wording checked against the engine rather than the printed rules, and the
 * counts against the two decks in `development/deck.ts`.
 */
export const CARD_GUIDE: readonly {
  readonly type: CardType;
  readonly effect: string;
  readonly base: number;
  readonly extended: number;
}[] = [
  { type: "knight", base: 14, extended: 20, effect: "移动强盗，从被压住的一位手上抽 1 张。亮出满 3 张拿最大骑士力，值 2 分，被别人超过就会易主。" },
  { type: "victory-point", base: 5, extended: 5, effect: "一直盖在手里，直接算 1 分，不用打出也打不出。别人看不到，所以你可能比记分板上显示的更接近获胜。" },
  { type: "road-building", base: 2, extended: 3, effect: "立刻免费建 2 条路，不花资源。剩余路子不够 2 条时，能建几条建几条。" },
  { type: "monopoly", base: 2, extended: 3, effect: "指定一种资源，其他所有人手里的这种牌全部交给你。" },
  { type: "resource-choice", base: 2, extended: 3, effect: "从银行取 2 张资源，可以要同一种。银行存量不够时这张打不出去。" },
];

const BUILDABLES: readonly { readonly key: keyof typeof BUILD_COSTS; readonly label: string; readonly note: string }[] = [
  { key: "road", label: "道路", note: "接着自己已有的路或建筑往外铺，连最长的一条争最长道路（2 分）。" },
  { key: "settlement", label: "村庄", note: "1 分。要落在自己道路连到的路口，且和任何建筑隔开至少两个路口。" },
  { key: "city", label: "城市", note: "2 分，由自己的村庄升级而来，产出翻倍。" },
  { key: "development", label: "发展卡", note: "随机抽一张，抽到什么算什么。" },
];

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
  brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿",
};

export function costText(key: keyof typeof BUILD_COSTS): string {
  return Object.entries(BUILD_COSTS[key])
    .filter(([, amount]) => amount > 0)
    .map(([resource, amount]) => (amount === 1 ? RESOURCE_LABELS[resource] : `${amount}${RESOURCE_LABELS[resource]}`))
    .join("+");
}

/**
 * Costs and card effects, reachable at any time.
 *
 * Both used to appear only inside the local player's action controls, which
 * render only on that player's own turn -- so the rules were hidden from
 * everyone who was not currently acting, which is most of the table.
 */
export function RulesReference({ ruleProfile, trigger }: {
  readonly ruleProfile: GameView["ruleProfile"];
  readonly trigger?: ReactNode;
}) {
  const extended = ruleProfile === "extended-5-6";
  const total = CARD_GUIDE.reduce((sum, card) => sum + (extended ? card.extended : card.base), 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="规则速查"
            title="规则速查"
            className="text-[var(--sidebar-muted,#37685d)]"
          >
            <BookOpen />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-[#f7e6bf]/30 bg-[#f8ecd2] p-4 text-[#263d39] sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>规则速查</DialogTitle>
          <DialogDescription className="text-[#66716b]">
            造什么要花什么，以及发展卡各是什么。随时可以打开，不用轮到自己。
          </DialogDescription>
        </DialogHeader>

        <section aria-label="建造成本">
          <h3 className="mb-1.5 text-sm font-black text-[#81551c]">建造成本</h3>
          <ul className="grid gap-2 text-sm">
            {BUILDABLES.map((item) => (
              <li key={item.key} className="rounded-xl border border-[#6d5434]/15 bg-white/55 px-3 py-2.5">
                <p className="mb-1 flex items-baseline justify-between gap-2">
                  <strong>{item.label}</strong>
                  <small className="shrink-0 font-black text-[#7d6136]">{costText(item.key)}</small>
                </p>
                <p className="leading-6 text-[#344b46]">{item.note}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="发展卡">
          <h3 className="mb-1.5 text-sm font-black text-[#81551c]">发展卡 · 共 {total} 张</h3>
          <ul className="grid gap-2 text-sm">
            {CARD_GUIDE.map((card) => (
              <li key={card.type} className="rounded-xl border border-[#6d5434]/15 bg-white/55 px-3 py-2.5">
                <p className="mb-1 flex items-baseline justify-between gap-2">
                  <strong>{cardLabel(card.type)}</strong>
                  <small className="shrink-0 text-[#7d6136]">{extended ? card.extended : card.base} 张</small>
                </p>
                <p className="leading-6 text-[#344b46]">{card.effect}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-[#bf8d35]/25 bg-[#fff2cb]/75 px-3 py-2.5 text-sm leading-6" aria-label="打出时机">
          <strong className="mb-1 block text-[#81551c]">发展卡什么时候打不出来</strong>
          <ul className="list-disc space-y-0.5 pl-4 text-[#344b46]">
            <li>当回合刚买到的卡，要等下个回合。</li>
            <li>每回合只能打出一张。</li>
            <li>骑士可以在掷骰前打出，先把强盗挪走再掷。</li>
            <li>胜利点不用打出，它一直在算分。</li>
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function cardLabel(type: string): string {
  return {
    knight: "骑士",
    "road-building": "道路建设",
    monopoly: "垄断",
    "resource-choice": "丰收",
    "victory-point": "隐藏胜利点",
  }[type] ?? type;
}
