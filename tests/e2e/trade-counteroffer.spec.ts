import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { GameCommand, GameCommandResponse, PlayerSessionResponse, RoomView } from "@catan/protocol";
import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const RESOURCES = ["brick", "lumber", "wool", "grain", "ore"] as const;
type Resource = (typeof RESOURCES)[number];
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
  const proposerRoom = await getRoom(request, proposer);
  const responderRoom = await getRoom(request, responder);
  const responderResource = firstHeldResource(responderRoom);
  if (responderResource === undefined) throw new Error("Responder received no setup resources");
  const proposerResource = firstHeldResource(proposerRoom, responderResource);

  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [proposerContext, responderContext] = contexts;
  if (proposerContext === undefined || responderContext === undefined) throw new Error("Missing browser contexts");
  await Promise.all([
    seedSession(proposerContext, proposer),
    seedSession(responderContext, responder),
  ]);
  const [proposerPage, responderPage] = await Promise.all([
    proposerContext.newPage(),
    responderContext.newPage(),
  ]);

  try {
    await Promise.all([proposerPage.goto("/"), responderPage.goto("/")]);
    await expect(proposerPage.getByRole("button", { name: "发起交易" })).toBeVisible();

    await proposerPage.getByRole("button", { name: "发起交易" }).click();
    await proposerPage.getByRole("spinbutton", { name: `你希望获得：${RESOURCE_LABELS[responderResource]}数量` }).fill("1");
    await proposerPage.getByRole("button", { name: "向所有玩家发布报价" }).click();

    await expect(responderPage.getByRole("dialog", { name: "查看报价并回应" })).toBeVisible();
    await responderPage.setViewportSize({ width: 390, height: 844 });
    await responderPage.getByRole("button", { name: "提出反报价" }).click();

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
    const artifactDir = path.join(process.cwd(), "output", "playwright");
    await mkdir(artifactDir, { recursive: true });
    await responderPage.screenshot({ path: path.join(artifactDir, "trade-counter-mobile.png"), fullPage: true });
    await responderPage.getByRole("button", { name: "提交反报价" }).click();

    await expect(proposerPage.getByRole("button", { name: new RegExp(`岚.*提出反报价`) })).toBeVisible();
    await proposerPage.screenshot({ path: path.join(artifactDir, "trade-counter-desktop.png"), fullPage: true });
    await proposerPage.getByRole("button", { name: new RegExp(`岚.*提出反报价`) }).click();
    await proposerPage.getByRole("button", { name: "接受所选反报价并成交" }).click();

    await expect(proposerPage.getByRole("dialog", { name: "等待桌上回应" })).toHaveCount(0);
    await expect(proposerPage.getByText(/林 给 岚|岚 给 林/).first()).toBeVisible();
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
  // Update controlled React inputs in order. Concurrent fills can race because
  // each basket change is derived from the latest rendered basket value.
  for (const resource of RESOURCES) {
    await page.getByRole("spinbutton", { name: `${label}：${RESOURCE_LABELS[resource]}数量` }).fill(String(resources[resource]));
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
