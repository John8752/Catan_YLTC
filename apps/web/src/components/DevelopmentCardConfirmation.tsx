import { useEffect, useRef, useState, type ReactElement } from "react";
import type { GameCommand, GameView } from "@catan/protocol";
import { Button } from "./ui/button.js";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.js";
import { resourceLabel } from "./ResourceCard.js";
import { RESOURCE_TYPES, emptyResourceHand, type ResourceHand, type ResourceType } from "@catan/game-core";
import { ResourceCardPalette, SelectedResourceCards } from "./ResourceCardPicker.js";
import { cardLabel } from "./RulesReference.js";

export type PlayDevelopmentCommand = Extract<GameCommand, {
  type: "PlayKnight" | "PlayRoadBuilding" | "PlayMonopoly" | "PlayResourceChoice";
}>;

export function DevelopmentCardConfirmation({ game, cardId, cardType, busy, onConfirm, children }: {
  readonly game: GameView;
  readonly cardId: string;
  readonly cardType: Exclude<GameView["you"]["developmentCards"][number]["type"], "victory-point">;
  readonly busy: boolean;
  readonly onConfirm: (command: PlayDevelopmentCommand) => void;
  readonly children: ReactElement;
}) {
  const [pending, setPending] = useState<{ revision: number } | null>(null);
  const [resource, setResource] = useState<ResourceType>("ore");
  const [selection, setSelection] = useState<ResourceHand>(emptyResourceHand);
  const resources = RESOURCE_TYPES.flatMap((resource) => Array.from({ length: selection[resource] }, () => resource));
  const maximums = resourceChoiceMaximums(selection, game.bankResources);
  const bankAvailable = game.bankResources === null || RESOURCE_TYPES.every((resource) => selection[resource] <= game.bankResources![resource]);
  const command: PlayDevelopmentCommand | null = cardType === "resource-choice"
    ? resources.length !== 2 || !bankAvailable ? null : { type: "PlayResourceChoice", cardId, resources: [resources[0]!, resources[1]!] }
    : cardType === "monopoly" ? { type: "PlayMonopoly", cardId, resource }
    : cardType === "knight" ? { type: "PlayKnight", cardId }
    : { type: "PlayRoadBuilding", cardId };
  const submitted = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  // A timer, trade or reconnect may replace the snapshot while the player reads.
  // Dismiss the old intent; the server still owns actual command legality.
  useEffect(() => setPending(null), [game.id, game.you.id, game.revision]);
  const current = pending !== null && pending.revision === game.revision;

  function confirm() {
    if (!current || busy || submitted.current || command === null) return;
    submitted.current = true;
    setPending(null);
    onConfirm(command);
    if (cardType === "resource-choice") setSelection(emptyResourceHand());
  }

  return <Dialog open={current} onOpenChange={(open) => {
    if (!open) setPending(null);
    else if (!busy) {
      submitted.current = false;
      setPending({ revision: game.revision });
    }
  }}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto border-[#f7e6bf]/30 bg-[#f8ecd2] text-[#263d39] sm:max-w-md"
      onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }}>
      <DialogHeader>
        <DialogTitle>确认使用{cardLabel(cardType)}？</DialogTitle>
        <DialogDescription className="leading-relaxed text-[#66716b]">
          {command === null ? "从银行选择 2 张资源，可以相同，也可以不同。" : describeCommand(command)}
          <span className="mt-2 block">确认后将打出这张发展卡。</span>
        </DialogDescription>
      </DialogHeader>
      {cardType === "monopoly" && <label className="grid gap-2 text-sm font-semibold">
        垄断要抢的资源
        <select className="h-11 w-full rounded-md border border-[#6d5434]/25 bg-[#fffaf0] px-3 text-base"
          value={resource} disabled={busy} onChange={(event) => setResource(event.target.value as ResourceType)}>
          {RESOURCE_TYPES.map((candidate) => <option key={candidate} value={candidate}>{resourceLabel(candidate)}</option>)}
        </select>
      </label>}
      {cardType === "resource-choice" && <fieldset disabled={busy} className="grid min-w-0 gap-3">
        <legend className="mb-2 text-sm font-semibold">选择 2 张资源 · 已选 {resources.length}/2</legend>
        <ResourceCardPalette label="丰收资源" value={selection} maximums={maximums}
          counts={game.bankResources ?? undefined} onChange={setSelection} />
        <SelectedResourceCards label="丰收已选资源" value={selection}
          emptyLabel="点击上方资源卡进行选择" onChange={setSelection} />
      </fieldset>}
      <DialogFooter>
        <DialogClose asChild><Button ref={cancel} type="button" variant="outline">取消</Button></DialogClose>
        <Button type="button" disabled={busy || !current || command === null} onClick={confirm}>确认使用</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function resourceChoiceMaximums(selection: ResourceHand, bank: ResourceHand | null): ResourceHand {
  const remaining = Math.max(0, 2 - RESOURCE_TYPES.reduce((total, resource) => total + selection[resource], 0));
  let maximums = emptyResourceHand();
  for (const resource of RESOURCE_TYPES) {
    maximums = { ...maximums, [resource]: Math.min(bank?.[resource] ?? 2, selection[resource] + remaining) };
  }
  return maximums;
}

function describeCommand(command: PlayDevelopmentCommand): string {
  switch (command.type) {
    case "PlayKnight": return "使用骑士后需要移动强盗，并在有可抢夺玩家时选择目标。";
    case "PlayRoadBuilding": return "使用后可免费修建最多 2 条道路，具体位置和数量需符合当前局面。";
    case "PlayMonopoly": return `收取其他玩家手中所有「${resourceLabel(command.resource)}」资源卡。`;
    case "PlayResourceChoice": return `从银行领取「${resourceLabel(command.resources[0])}」和「${resourceLabel(command.resources[1])}」，共 2 张资源卡。`;
  }
}
