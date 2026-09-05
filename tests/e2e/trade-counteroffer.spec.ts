import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { GameCommand, GameCommandResponse, PlayerSessionResponse, RoomView } from "@catan/protocol";
import { expect, test, type APIRequestContext, type BrowserContext, type Page, type Route } from "@playwright/test";
import { iPhone16BrowserAreaCases } from "./viewport-cases.js";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = Extract<GameCommand, { readonly type: "MaritimeTrade" }>["give"];
type ResourceCounts = Record<Resource, number>;
type Session = Pick<PlayerSessionResponse, "roomId" | "playerId" | "seatToken">;

const RESOURCE_LABELS: Record<Resource, string> = {
  brick: "砖",
  lumber: "木",
  wool: "羊",
  grain: "麦",
  ore: "矿",
};

test("players can publish, counter and complete a trade on desktop and mobile", async ({ browser, request }) => {
  const hostResponse = await request.post("/api/rooms", { data: { playerName: "林" } });
  const host = await hostResponse.json() as PlayerSessionResponse;
  const secondResponse = await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: "岚" } });
  const second = await secondResponse.json() as PlayerSessionResponse;
  const thirdResponse = await request.post(`/api/rooms/${host.roomId}/join`, { data: { playerName: "舟" } });
  const third = await thirdResponse.json() as PlayerSessionResponse;
  const sessions: readonly Session[] = [host, second, third];

  const startResponse = await request.post(`/api/rooms/${host.roomId}/start`, { data: { seatToken: host.seatToken } });
  let room = await startResponse.json() as RoomView;
  let commandNumber = 0;

  while (room.game?.phase.kind === "setup") {
    const actorId = room.game.phase.placementOrder[room.game.phase.placementIndex];
    const actor = requireSession(sessions, actorId);
    const actorRoom = await getRoom(request, actor);
    if (actorRoom.game?.interaction.kind === "setup-settlement") {
      const vertexId = bestProducingVertex(actorRoom, actorRoom.game.interaction.vertexIds);
      room = await command(request, actor, actorRoom, ++commandNumber, { type: "PlaceInitialSettlement", vertexId });
    } else if (actorRoom.game?.interaction.kind === "setup-road") {
      const edgeId = actorRoom.game.interaction.edgeIds[0];
      if (edgeId === undefined) throw new Error("Missing setup road target");
      room = await command(request, actor, actorRoom, ++commandNumber, { type: "PlaceInitialRoad", edgeId });
    } else {
      throw new Error("Setup actor has no placement interaction");
    }
  }

  room = await reachActionStage(request, sessions, room, () => ++commandNumber);
  const proposerId = room.game?.phase.kind === "turn" ? room.game.phase.activePlayerId : undefined;
  const proposer = requireSession(sessions, proposerId);
  const responder = sessions.find((session) => session.playerId !== proposer.playerId);
  if (responder === undefined) throw new Error("Missing trade responder");
  const thirdResponder = sessions.find((session) => session.playerId !== proposer.playerId && session.playerId !== responder.playerId);
  if (thirdResponder === undefined) throw new Error("Missing third trade responder");
  const proposerRoom = await getRoom(request, proposer);
  const responderRoom = await getRoom(request, responder);
  const responderResource = firstHeldResource(responderRoom);
  if (responderResource === undefined) throw new Error("Responder received no setup resources");
  const proposerResource = firstHeldResource(proposerRoom, responderResource);

  const portrait = iPhone16BrowserAreaCases.find((candidate) => candidate.name.includes("portrait"));
  if (portrait === undefined) throw new Error("Missing focused iPhone portrait viewport case");
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext({ ...portrait.options, viewport: { width: portrait.width, height: portrait.height } }),
    browser.newContext({ ...portrait.options, viewport: { width: portrait.width, height: portrait.height } }),
  ]);
  const [proposerContext, responderContext, thirdResponderContext] = contexts;
  if (proposerContext === undefined || responderContext === undefined || thirdResponderContext === undefined) throw new Error("Missing browser contexts");
  await Promise.all([
    seedSession(proposerContext, proposer),
    seedSession(responderContext, responder),
    seedSession(thirdResponderContext, thirdResponder),
  ]);
  const [proposerPage, responderPage, thirdResponderPage] = await Promise.all([
    proposerContext.newPage(),
    responderContext.newPage(),
    thirdResponderContext.newPage(),
  ]);
  if (proposerPage === undefined || responderPage === undefined || thirdResponderPage === undefined) throw new Error("Missing browser pages");

  try {
    await Promise.all([proposerPage.goto("/"), responderPage.goto("/"), thirdResponderPage.goto("/")]);
    await expect(proposerPage.getByRole("button", { name: "发起交易" })).toBeVisible();

    await proposerPage.getByRole("button", { name: "发起交易" }).click();
    await expect(proposerPage.getByRole("region", { name: "交易编辑器" })).toBeVisible();
    await expect(proposerPage.locator('[data-board-root="true"]')).toBeVisible();
    await expect(proposerPage.getByRole("dialog", { name: "交易桌" })).toBeVisible();
    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    await proposerPage.screenshot({ path: path.join(artifactDir, "trade-composer-desktop.png"), fullPage: true });
    await proposerPage.keyboard.press("Escape");
    await expect(proposerPage.getByRole("dialog", { name: "交易桌" })).toBeHidden();
    await proposerPage.setViewportSize({ width: 390, height: 844 });
    await proposerPage.getByRole("button", { name: "展开本回合操作" }).click();
    await proposerPage.getByRole("button", { name: "发起交易" }).click();
    await expect(proposerPage.getByRole("dialog", { name: "交易桌" })).toBeVisible();
    await expect.poll(() => proposerPage.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    await proposerPage.waitForTimeout(250);
    await proposerPage.screenshot({ path: path.join(artifactDir, "trade-composer-mobile.png"), fullPage: true });
    await proposerPage.getByRole("button", { name: new RegExp(`在我希望获得中加入 1 张${RESOURCE_LABELS[responderResource]}`) }).click();
    await proposerPage.getByRole("button", { name: "向所有玩家发布报价" }).click();
    await proposerPage.setViewportSize({ width: 1280, height: 720 });

    await expect(responderPage.getByRole("region", { name: "查看报价并回应" })).toBeVisible();
    await expect(thirdResponderPage.getByRole("region", { name: "查看报价并回应" })).toBeVisible();
    await expect.poll(() => thirdResponderPage.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight + 1,
    }))).toEqual({ horizontal: true, vertical: true });

    let forcedStaleRevision = false;
    const commandUrl = new RegExp(`/api/rooms/${responder.roomId}/commands$`);
    const forceOneStaleRevision = async (route: Route) => {
      if (!forcedStaleRevision) {
        forcedStaleRevision = true;
        const thirdRoom = await getRoom(request, thirdResponder);
        await command(request, thirdResponder, thirdRoom, ++commandNumber, {
          type: "DeclineTradeOffer",
          offerId: thirdRoom.game?.openTrade?.offerId ?? "",
        });
      }
      await route.continue();
    };
    await responderPage.route(commandUrl, forceOneStaleRevision);
    // Disabled also means "request pending". Wait for the successful retry before removing its interceptor.
    const acceptedResponse = responderPage.waitForResponse((response) => commandUrl.test(response.url()) && response.ok()
      && response.request().postDataJSON()?.command?.type === "AcceptTradeOffer");
    await responderPage.getByRole("button", { name: "同意" }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect(responderPage.getByRole("button", { name: "同意" })).toBeDisabled();
    await expect(responderPage.getByRole("alert")).toHaveCount(0);
    await acceptedResponse;
    await responderPage.unroute(commandUrl, forceOneStaleRevision);
    expect(forcedStaleRevision).toBe(true);
    await expect(thirdResponderPage.getByRole("button", { name: "拒绝" })).toBeDisabled();
    const acceptedRoom = await getRoom(request, responder);
    const responderName = acceptedRoom.members.find((member) => member.id === responder.playerId)?.name;
    if (responderName === undefined) throw new Error("Missing responder name");
    expect(acceptedRoom.game?.history.filter((entry) => entry.message === `${responderName} 接受报价`)).toHaveLength(1);

    await responderPage.getByRole("button", { name: "反报价" }).click();

    const proposerGives = emptyResources();
    const proposerReceives = emptyResources();
    if (proposerResource === undefined) {
      proposerReceives[responderResource] = 1;
    } else {
      proposerGives[proposerResource] = 1;
      if (proposerResource !== responderResource) proposerReceives[responderResource] = 1;
    }
    await fillCounterBasket(responderPage, "反报价中你希望获得", proposerGives);
    await fillCounterBasket(responderPage, "反报价中你愿意交出", proposerReceives);
    await expect.poll(() => responderPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await responderPage.screenshot({ path: path.join(artifactDir, "trade-counter-mobile.png"), fullPage: true });
    await responderPage.getByRole("button", { name: "提交反报价" }).click();
    await expect(responderPage.getByText("反报价已公开，可以继续修改")).toBeVisible();
    await responderPage.getByRole("button", { name: "反报价" }).click();
    await expect(responderPage.getByRole("button", { name: "提交反报价" })).toBeDisabled();
    await expect(responderPage.getByText("反报价条款尚未改变")).toBeVisible();

    const counterRoom = await getRoom(request, responder);
    const repeatedCounter = await command(request, responder, counterRoom, ++commandNumber, {
      type: "CounterTradeOffer",
      offerId: counterRoom.game?.openTrade?.offerId ?? "",
      proposerGives,
      proposerReceives,
    });
    expect(repeatedCounter.revision).toBe(counterRoom.revision);
    expect(repeatedCounter.game?.revision).toBe(counterRoom.game?.revision);
    expect(repeatedCounter.game?.history).toEqual(counterRoom.game?.history);

    await expect(proposerPage.getByRole("button", { name: "岚：提出反报价" })).toBeVisible();
    await proposerPage.screenshot({ path: path.join(artifactDir, "trade-counter-desktop.png"), fullPage: true });
    await proposerPage.getByRole("button", { name: "岚：提出反报价" }).click();
    await proposerPage.getByRole("button", { name: "接受所选反报价" }).click();

    await expect(proposerPage.getByRole("region", { name: "等待桌上回应" })).toHaveCount(0);
    await expect(proposerPage.getByText(/林 与 岚|岚 与 林/).first()).toBeVisible();

    await expect.poll(async () => (await getRoom(request, proposer)).game?.openTrade, {
      message: "trade completion should reach the server",
    }).toBeNull();
    const discard = await reachDiscardStage(request, sessions, await getRoom(request, proposer), () => ++commandNumber);
    const discardContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    contexts.push(discardContext);
    await seedSession(discardContext, discard.session);
    const discardPage = await discardContext.newPage();
    await discardPage.goto("/");

    await expect(discardPage.getByRole("button", { name: "确认弃牌" })).toBeVisible();
    await expect(discardPage.locator("[data-resource-flight]")).toHaveCount(0);
    const discardSelection = selectResources(discard.room.game?.you.resources ?? emptyResources(), discard.requiredCount);
    for (const resource of RESOURCES) {
      for (let index = 0; index < discardSelection[resource]; index += 1) {
        await discardPage.getByRole("button", { name: new RegExp(`在准备弃掉中加入 1 张${RESOURCE_LABELS[resource]}`) }).click();
      }
    }
    const selectedResource = RESOURCES.find((resource) => discardSelection[resource] > 0);
    if (selectedResource === undefined) throw new Error("Discard selection is empty");
    await discardPage.getByRole("button", { name: new RegExp(`从准备弃掉移除 1 张${RESOURCE_LABELS[selectedResource]}`) }).click();
    await expect(discardPage.getByRole("button", { name: "确认弃牌" })).toBeDisabled();
    await discardPage.getByRole("button", { name: new RegExp(`在准备弃掉中加入 1 张${RESOURCE_LABELS[selectedResource]}`) }).click();
    await expect(discardPage.getByRole("button", { name: "确认弃牌" })).toBeEnabled();
    await discardPage.screenshot({ path: path.join(artifactDir, "discard-cards-mobile.png"), fullPage: true });
    await discardPage.getByRole("button", { name: "确认弃牌" }).click();
    await expect(discardPage.getByRole("button", { name: "确认弃牌" })).toHaveCount(0);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});

async function reachActionStage(
  request: APIRequestContext,
  sessions: readonly Session[],
  initialRoom: RoomView,
  nextCommandNumber: () => number,
): Promise<RoomView> {
  let room = initialRoom;
  for (let guard = 0; guard < 20; guard += 1) {
    if (room.game?.phase.kind !== "turn") throw new Error("Game did not enter a turn");
    if (room.game.phase.step === "action") return room;
    const active = requireSession(sessions, room.game.phase.activePlayerId);

    if (room.game.phase.step === "roll") {
      const activeRoom = await getRoom(request, active);
      room = await command(request, active, activeRoom, nextCommandNumber(), { type: "RollDice" });
      continue;
    }
    if (room.game.phase.step === "discard") {
      let discarded = false;
      for (const session of sessions) {
        const playerRoom = await getRoom(request, session);
        if (playerRoom.game?.interaction.kind !== "discard") continue;
        const resources = selectResources(playerRoom.game.you.resources, playerRoom.game.interaction.requiredCount);
        room = await command(request, session, playerRoom, nextCommandNumber(), { type: "DiscardResources", resources });
        discarded = true;
        break;
      }
      if (!discarded) throw new Error("No player can resolve the pending discard");
      continue;
    }
    if (room.game.phase.step === "robber") {
      const activeRoom = await getRoom(request, active);
      if (activeRoom.game?.interaction.kind !== "robber") throw new Error("Active player has no robber targets");
      const target = activeRoom.game.interaction.targets.find((candidate) => candidate.victimIds.length === 0)
        ?? activeRoom.game.interaction.targets[0];
      if (target === undefined) throw new Error("Missing robber target");
      room = await command(request, active, activeRoom, nextCommandNumber(), {
        type: "MoveRobber",
        hexId: target.hexId,
        victimId: target.victimIds[0] ?? null,
      });
      continue;
    }
    throw new Error(`Unexpected forced step ${room.game.phase.step}`);
  }
  throw new Error("Action stage guard exhausted");
}

async function reachDiscardStage(
  request: APIRequestContext,
  sessions: readonly Session[],
  initialRoom: RoomView,
  nextCommandNumber: () => number,
): Promise<{ readonly session: Session; readonly room: RoomView; readonly requiredCount: number }> {
  let room = initialRoom;
  for (let guard = 0; guard < 180; guard += 1) {
    if (room.game?.phase.kind !== "turn") throw new Error("Game left the turn phase before a discard occurred");
    const active = requireSession(sessions, room.game.phase.activePlayerId);
    if (room.game.phase.step === "action") {
      const activeRoom = await getRoom(request, active);
      room = await command(request, active, activeRoom, nextCommandNumber(), { type: "EndTurn" });
      continue;
    }
    if (room.game.phase.step === "roll") {
      const activeRoom = await getRoom(request, active);
      room = await command(request, active, activeRoom, nextCommandNumber(), { type: "RollDice" });
      continue;
    }
    if (room.game.phase.step === "discard") {
      for (const session of sessions) {
        const playerRoom = await getRoom(request, session);
        if (playerRoom.game?.interaction.kind === "discard") {
          return { session, room: playerRoom, requiredCount: playerRoom.game.interaction.requiredCount };
        }
      }
      throw new Error("Discard phase has no projected discarder");
    }
    if (room.game.phase.step === "robber") {
      const activeRoom = await getRoom(request, active);
      if (activeRoom.game?.interaction.kind !== "robber") throw new Error("Active player has no robber targets");
      const target = activeRoom.game.interaction.targets.find((candidate) => candidate.victimIds.length === 0)
        ?? activeRoom.game.interaction.targets[0];
      if (target === undefined) throw new Error("Missing robber target while seeking discard stage");
      room = await command(request, active, activeRoom, nextCommandNumber(), {
        type: "MoveRobber",
        hexId: target.hexId,
        victimId: target.victimIds[0] ?? null,
      });
      continue;
    }
    throw new Error(`Unexpected step while seeking discard: ${room.game.phase.step}`);
  }
  throw new Error("No discard occurred before the command guard was exhausted");
}

async function command(
  request: APIRequestContext,
  session: Session,
  room: RoomView,
  commandNumber: number,
  gameCommand: GameCommand,
): Promise<RoomView> {
  const revision = room.game?.revision;
  if (revision === undefined) throw new Error("Missing game revision");
  const response = await request.post(`/api/rooms/${session.roomId}/commands`, {
    data: {
      seatToken: session.seatToken,
      commandId: `e2e-trade-${commandNumber}`,
      expectedRevision: revision,
      command: gameCommand,
    },
  });
  if (!response.ok()) throw new Error(`Command ${gameCommand.type} failed: ${await response.text()}`);
  return (await response.json() as GameCommandResponse).room;
}

async function getRoom(request: APIRequestContext, session: Session): Promise<RoomView> {
  const response = await request.get(`/api/rooms/${session.roomId}`, { params: { seatToken: session.seatToken } });
  if (!response.ok()) throw new Error(`Room projection failed: ${await response.text()}`);
  return await response.json() as RoomView;
}

function bestProducingVertex(room: RoomView, vertexIds: readonly string[]): string {
  const game = room.game;
  if (game === null) throw new Error("Missing game");
  const scored = vertexIds.map((vertexId) => {
    const vertex = game.map.vertices.find((candidate) => candidate.id === vertexId);
    const score = vertex?.adjacentHexIds.filter((hexId) =>
      game.map.hexes.some((hex) => hex.id === hexId && hex.terrain !== "desert"),
    ).length ?? -1;
    return { vertexId, score };
  }).sort((first, second) => second.score - first.score);
  const selected = scored[0]?.vertexId;
  if (selected === undefined) throw new Error("Missing setup settlement target");
  return selected;
}

function firstHeldResource(room: RoomView, exclude?: Resource): Resource | undefined {
  const resources = room.game?.you.resources;
  return resources === undefined ? undefined : RESOURCES.find((resource) => resource !== exclude && resources[resource] > 0);
}

function selectResources(hand: ResourceCounts, count: number): ResourceCounts {
  const selected = emptyResources();
  let remaining = count;
  for (const resource of RESOURCES) {
    const amount = Math.min(hand[resource], remaining);
    selected[resource] = amount;
    remaining -= amount;
  }
  if (remaining !== 0) throw new Error("Cannot satisfy discard count");
  return selected;
}

async function seedSession(context: BrowserContext, session: Session): Promise<void> {
  await context.addInitScript((seat) => {
    window.localStorage.setItem("catan-yltc-seat", JSON.stringify(seat));
  }, session);
}

async function fillCounterBasket(page: Page, label: string, resources: ResourceCounts): Promise<void> {
  for (const resource of RESOURCES) {
    const remove = page.getByRole("button", { name: new RegExp(`从${label}移除 1 张${RESOURCE_LABELS[resource]}`) });
    while (await remove.count() > 0) await remove.click();
    const add = page.getByRole("button", { name: new RegExp(`在${label}中加入 1 张${RESOURCE_LABELS[resource]}`) });
    for (let index = 0; index < resources[resource]; index += 1) await add.click();
  }
}

function requireSession(sessions: readonly Session[], playerId: string | undefined): Session {
  const session = sessions.find((candidate) => candidate.playerId === playerId);
  if (session === undefined) throw new Error(`Missing session for ${playerId ?? "unknown player"}`);
  return session;
}

function emptyResources(): ResourceCounts {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 };
}
