import type { GameCommand, GameView } from "@catan/protocol";
import { BookOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.js";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];
type CardType = GameView["you"]["developmentCards"][number]["type"];

/**
 * Wording checked against the engine rather than the printed rules, and the
 * counts against the two decks in `development/deck.ts`.
 */
const CARD_GUIDE: readonly {
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

export interface DevelopmentControlsProps {
  readonly game: GameView;
  readonly busy: boolean;
  readonly onCommand: (command: GameCommand) => void;
}

export function DevelopmentControls({ game, busy, onCommand }: DevelopmentControlsProps) {
  const [resource, setResource] = useState<Resource>("ore");
  const [secondResource, setSecondResource] = useState<Resource>("grain");
  const canBuy = game.interaction.kind === "turn-action" &&
    game.developmentDeckCount > 0 &&
    game.you.resources.wool > 0 &&
    game.you.resources.grain > 0 &&
    game.you.resources.ore > 0;
  const turnNumber = game.phase.kind === "turn" ? game.phase.turnNumber : 0;

  if (game.interaction.kind !== "turn-action" && game.interaction.kind !== "turn-roll") return null;

  return (
    <details className="development-drawer min-w-0 rounded-md border border-[var(--sidebar-line,#4e39232e)] bg-[var(--sidebar-control,#fffaf0b3)]" data-resource-sink="development">
      <summary className="h-8 cursor-pointer list-inside content-center px-2 text-sm font-bold whitespace-nowrap">发展卡（{game.you.developmentCards.length}）</summary>
      <div className="development-stack p-2">
        <DevelopmentGuide ruleProfile={game.ruleProfile} />
        {game.you.developmentCards.length === 0 ? <p>尚无发展卡</p> : null}
        {game.you.developmentCards.map((card) => {
          const playable =
            card.type !== "victory-point" &&
            card.acquiredTurn < turnNumber &&
            !game.developmentCardPlayedThisTurn;
          // Why the button is grey. The drawer is too narrow to say it in place,
          // so it rides on the button and is spelled out in the guide.
          const blocker = card.type === "victory-point" || playable
            ? undefined
            : game.developmentCardPlayedThisTurn
              ? "本回合已经用过一张发展卡"
              : card.acquiredTurn >= turnNumber
                ? "本回合刚买到，下回合才能用"
                : "先掷骰子";
          return (
            <div className="development-card text-[#263d39]" key={card.id}>
              <span>{cardLabel(card.type)}</span>
              {card.type === "victory-point" ? <small>隐藏 1 分</small> : null}
              {card.type === "monopoly" ? <ResourceSelect value={resource} onChange={setResource} label="垄断要抢的资源" /> : null}
              {card.type === "resource-choice" ? (
                <span className="card-selects">
                  <ResourceSelect value={resource} onChange={setResource} label="丰收的第一张资源" />
                  <ResourceSelect value={secondResource} onChange={setSecondResource} label="丰收的第二张资源" />
                </span>
              ) : null}
              {card.type === "victory-point" ? null : (
                <button
                  className="build-button"
                  type="button"
                  disabled={busy || !playable}
                  title={blocker}
                  onClick={() => onCommand(cardCommand(card.id, card.type, resource, secondResource))}
                >
                  使用
                </button>
              )}
            </div>
          );
        })}
        {game.interaction.kind === "turn-action" ? (
          <button className="build-button" type="button" disabled={busy || !canBuy} onClick={() => onCommand({ type: "BuyDevelopmentCard" })}>
            购买发展卡（羊+麦+矿）· 剩余 {game.developmentDeckCount}
          </button>
        ) : null}
      </div>
    </details>
  );
}

function DevelopmentGuide({ ruleProfile }: { readonly ruleProfile: GameView["ruleProfile"] }) {
  const extended = ruleProfile === "extended-5-6";
  const total = CARD_GUIDE.reduce((sum, card) => sum + (extended ? card.extended : card.base), 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-7 w-full justify-center gap-1 px-1 text-xs">
          <BookOpen className="size-3.5 shrink-0" />说明
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto border-[#f7e6bf]/30 bg-[#f8ecd2] p-4 text-[#263d39] sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>发展卡说明</DialogTitle>
          <DialogDescription className="text-[#66716b]">
            这副牌共 {total} 张，买一张要羊、麦、矿各 1。抽到哪张是随机的。
          </DialogDescription>
        </DialogHeader>

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

        <section className="rounded-xl border border-[#bf8d35]/25 bg-[#fff2cb]/75 px-3 py-2.5 text-sm leading-6" aria-label="打出时机">
          <strong className="mb-1 block text-[#81551c]">什么时候打不出来</strong>
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

function cardCommand(
  cardId: string,
  type: CardType,
  resource: Resource,
  secondResource: Resource,
): GameCommand {
  switch (type) {
    case "knight": return { type: "PlayKnight", cardId };
    case "road-building": return { type: "PlayRoadBuilding", cardId };
    case "monopoly": return { type: "PlayMonopoly", cardId, resource };
    case "resource-choice": return { type: "PlayResourceChoice", cardId, resources: [resource, secondResource] };
    case "victory-point": throw new Error("Victory point cards are passive");
  }
}

function ResourceSelect({ value, onChange, label }: {
  readonly value: Resource;
  readonly onChange: (value: Resource) => void;
  readonly label: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value as Resource)}>
      {RESOURCES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
    </select>
  );
}

function cardLabel(type: string): string {
  return {
    knight: "骑士",
    "road-building": "道路建设",
    monopoly: "垄断",
    "resource-choice": "丰收",
    "victory-point": "隐藏胜利点",
  }[type] ?? type;
}

function resourceLabel(resource: Resource): string {
  return { brick: "砖", lumber: "木", wool: "羊", grain: "麦", ore: "矿" }[resource];
}
