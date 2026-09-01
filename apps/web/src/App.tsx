import type { GameCommand, RoomSettingsInput, RoomView } from "@catan/protocol";
import { useEffect, useState } from "react";
import {
  ApiError,
  connectToRoom,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  rerollRoomMap,
  startRoom,
  submitGameCommand,
  updateRoomSettings,
  type PlayerSession,
} from "./api.js";
import { Board } from "./components/Board.js";
import { BankSupply } from "./components/BankSupply.js";
import { BankSupplyButton } from "./components/BankSupplyButton.js";
import { ResponsiveRoomPanel } from "./components/ResponsiveRoomPanel.js";
import { useMediaQuery } from "./hooks/use-media-query.js";
import { GameResult } from "./components/GameResult.js";
import { LobbySetup } from "./components/LobbySetup.js";
import { GameSidebar } from "./components/GameSidebar.js";
import { OpponentStrip } from "./components/OpponentStrip.js";
import { PlayerDock } from "./components/PlayerDock.js";
import { RoomPanel } from "./components/RoomPanel.js";
import { ActiveTradePanel } from "./components/ActiveTradePanel.js";
import { Welcome } from "./components/Welcome.js";
import { ResourceEffectLayer } from "./effects/ResourceEffectLayer.js";
import { DevelopmentEffectLayer, isDevelopmentEffect } from "./effects/DevelopmentEffectLayer.js";
import { useGameEffectQueue } from "./effects/use-game-effect-queue.js";
import { useActionAttention } from "./effects/use-action-attention.js";
import { useVictoryWarnings } from "./effects/use-victory-warnings.js";
import {
  adoptLegacyTabSession,
  createPlayerSessionStore,
  seatSlotFromLocation,
} from "./player-session.js";

adoptLegacyTabSession(window.sessionStorage, window.localStorage);
const seatSlot = seatSlotFromLocation(window.location.search);
const playerSessionStore = createPlayerSessionStore(window.localStorage, seatSlot);
export function App() {
  const bankInSidebar = useMediaQuery("(min-width: 1024px)");
  const [boardInfoHost, setBoardInfoHost] = useState<HTMLDivElement | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(() => readSession());
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "offline">(
    "offline",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<"road" | "settlement" | "city" | null>(null);
  const [selectedRobberHexId, setSelectedRobberHexId] = useState<string | null>(null);
  const [snapshotEpoch, setSnapshotEpoch] = useState(0);
  const { activeEffect, completeActiveEffect } = useGameEffectQueue(room?.game ?? null);
  const actionNotice = useActionAttention(room?.game ?? null, snapshotEpoch, connectionState === "live");
  const victoryNotice = useVictoryWarnings(room?.game ?? null, snapshotEpoch, connectionState === "live", actionNotice !== null);

  useEffect(() => {
    if (session === null) {
      return;
    }

    let active = true;
    setConnectionState("connecting");
    void getRoom(session)
      .then((nextRoom) => {
        if (active) setRoom(nextRoom);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      });

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const openSocket = () => {
      if (!active) return;
      setConnectionState("connecting");
      let initialSnapshot = true;
      socket = connectToRoom(session, (message) => {
        if (!active) return;

        if (message.type === "room_state") {
          if (initialSnapshot) {
            setSnapshotEpoch((epoch) => epoch + 1);
            initialSnapshot = false;
          }
          setRoom(message.room);
          setError(null);
        } else {
          setError(message.message);
        }
      });
      socket.addEventListener("open", () => active && setConnectionState("live"));
      socket.addEventListener("close", () => {
        if (!active) return;
        setConnectionState("offline");
        reconnectTimer = window.setTimeout(openSocket, 1_000);
      });
    };
    openSocket();

    return () => {
      active = false;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (socket !== null) closeSocket(socket);
    };
  }, [session]);

  useEffect(() => {
    setBuildMode(null);
    setSelectedRobberHexId(null);
  }, [room?.game?.revision]);

  async function handleCreate(playerName: string) {
    await runBusy(async () => {
      const response = await createRoom(playerName);
      storeSession({ roomId: response.roomId, playerId: response.playerId, seatToken: response.seatToken });
      setRoom(response.room);
      setBuildMode(null);
      setSelectedRobberHexId(null);
    });
  }

  async function handleJoin(roomId: string, playerName: string) {
    await runBusy(async () => {
      const response = await joinRoom(roomId, playerName);
      storeSession({ roomId: response.roomId, playerId: response.playerId, seatToken: response.seatToken });
      setRoom(response.room);
      setBuildMode(null);
      setSelectedRobberHexId(null);
    });
  }

  async function handleStart() {
    if (session === null) return;
    await runBusy(async () => setRoom(await startRoom(session)));
  }

  async function handleRoomSettingsChange(settings: RoomSettingsInput) {
    if (session === null || room === null || room.game !== null) return;
    await runBusy(async () => {
      try {
        setRoom(await updateRoomSettings(session, room.revision, settings));
      } catch (caught) {
        if (isStaleStateError(caught)) setRoom(await getRoom(session));
        throw caught;
      }
    });
  }

  async function handleRerollMap() {
    if (session === null || room === null || room.game !== null) return;
    await runBusy(async () => {
      try {
        setRoom(await rerollRoomMap(session, room.revision));
      } catch (caught) {
        if (isStaleStateError(caught)) setRoom(await getRoom(session));
        throw caught;
      }
    });
  }

  async function handleGameCommand(command: GameCommand) {
    if (session === null || room?.game === null || room?.game === undefined) return;
    await runBusy(async () => {
      try {
        const response = await submitGameCommand(session, room.game?.revision ?? 0, command);
        setRoom(response.room);
      } catch (caught) {
        if (isStaleStateError(caught)) setRoom(await getRoom(session));
        throw caught;
      }
    });
  }

  function handleRobberHexSelect(hexId: string) {
    if (room?.game?.interaction.kind !== "robber" || busy) return;
    const target = room.game.interaction.targets.find((candidate) => candidate.hexId === hexId);
    if (target === undefined) return;

    if (target.victimIds.length <= 1) {
      setSelectedRobberHexId(null);
      void handleGameCommand({
        type: "MoveRobber",
        hexId,
        victimId: target.victimIds[0] ?? null,
      });
      return;
    }

    setSelectedRobberHexId(hexId);
  }

  async function handleLeave() {
    if (session === null) return;
    await runBusy(async () => {
      await leaveRoom(session);
      clearCurrentSession();
    });
  }

  function clearCurrentSession() {
    playerSessionStore.clear();
    setSession(null);
    setRoom(null);
    setError(null);
    setBuildMode(null);
    setSelectedRobberHexId(null);
  }

  async function runBusy(action: () => Promise<void>) {
    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function storeSession(nextSession: PlayerSession) {
    playerSessionStore.write(nextSession);
    setSession(nextSession);
  }

  if (session === null) {
    return <Welcome busy={busy} error={error} onCreate={handleCreate} onJoin={handleJoin} />;
  }

  if (room === null) {
    return (
      <main className="loading-table">
        <span className="brand-mark" aria-hidden="true">⬡</span>
        <p>{error ?? "正在重新铺好桌面…"}</p>
        <button className="quiet-button" type="button" onClick={clearCurrentSession}>清除失效会话并返回</button>
      </main>
    );
  }

  const liveGame = room.game;
  // Route one bank/effect anchor to its current surface; do not mount hidden copies.
  const bankSupply = liveGame === null ? null : bankInSidebar
    ? <BankSupply resources={liveGame.bankResources} className="mr-0 w-full shrink-0 justify-center border-transparent bg-transparent shadow-none backdrop-blur-none lg:rounded-none lg:[&>span]:bg-white/5 lg:[&>span]:text-[var(--game-rail-muted)]" />
    : <BankSupplyButton resources={liveGame.bankResources} />;
  const roomControls = <ResponsiveRoomPanel
    room={room} playerId={session.playerId} connectionState={connectionState} busy={busy}
    onStart={handleStart} onSettingsChange={handleRoomSettingsChange} onLeave={handleLeave}
    embedded showPlayers={false} className="min-h-0 flex-1"
  />;

  return (
    <main className={liveGame === null
      ? "game-layout grid min-h-svh grid-cols-1 gap-3 p-3 lg:h-svh lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden"
      : "game-layout live-game-layout grid h-dvh min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden p-[max(.35rem,env(safe-area-inset-top),env(safe-area-inset-bottom),env(safe-area-inset-left),env(safe-area-inset-right))] phone-landscape:grid-cols-[minmax(0,1fr)_14rem] phone-landscape:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_var(--game-rail-width)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-3 lg:p-[max(.75rem,env(safe-area-inset-top),env(safe-area-inset-bottom),env(safe-area-inset-left),env(safe-area-inset-right))] xl:grid-cols-[var(--game-opponent-width)_minmax(0,1fr)_var(--game-rail-width)] xl:grid-rows-[minmax(0,1fr)]"}>
      {liveGame === null ? <div className="game-brand lg:col-start-1 lg:row-start-1" aria-label="Catan YLTC">
        <span aria-hidden="true">⬡</span>
        <strong>Catan YLTC</strong>
      </div> : null}
      {liveGame === null ? null : <OpponentStrip game={liveGame} />}
      <div className={liveGame === null ? "playfield min-h-[420px] lg:col-start-1 lg:row-start-2 lg:min-h-0" : "playfield live-playfield col-start-1 row-start-2 min-h-0 min-w-0 overflow-hidden xl:col-start-2 xl:row-start-1"}>
        {room.game === null ? (
          <LobbySetup
            room={room}
            isHost={room.hostPlayerId === session.playerId}
            busy={busy}
            onReroll={handleRerollMap}
          />
        ) : (
          <>
            <Board
              game={room.game}
              compact={!bankInSidebar}
              infoHost={bankInSidebar ? boardInfoHost : null}
              roomControls={bankInSidebar ? null : roomControls}
              actionNotice={actionNotice}
              victoryNotice={victoryNotice}
              bankSupply={bankInSidebar ? null : bankSupply}
              busy={busy}
              buildMode={buildMode}
              selectedRobberHexId={selectedRobberHexId}
              onCommand={handleGameCommand}
              onRobberHexSelect={handleRobberHexSelect}
            />
            <DevelopmentEffectLayer
              effect={isDevelopmentEffect(activeEffect) ? activeEffect : null}
              currentPlayerId={session.playerId}
              playerName={(playerId) => liveGame?.players.find((player) => player.id === playerId)?.name ?? "玩家"}
              onComplete={completeActiveEffect}
            />
            {room.game.phase.kind === "finished" && activeEffect === null ? <GameResult game={room.game} /> : null}
          </>
        )}
      </div>
      {liveGame === null ? <RoomPanel
        room={room}
        playerId={session.playerId}
        connectionState={connectionState}
        busy={busy}
        onStart={handleStart}
        onSettingsChange={handleRoomSettingsChange}
        onLeave={handleLeave}
      /> : <GameSidebar
        bankSupply={bankInSidebar ? bankSupply : null}
        roomControls={bankInSidebar ? roomControls : null}
        onInfoMount={setBoardInfoHost}
      >
        <PlayerDock
          game={liveGame}
          compact={!bankInSidebar}
          busy={busy}
          onCommand={handleGameCommand}
          buildMode={buildMode}
          selectedRobberHexId={selectedRobberHexId}
          onBuildModeChange={setBuildMode}
        />
      </GameSidebar>}
      {liveGame?.openTrade === null || liveGame === null ? null : (
        <div className="active-trade-surface">
          <ActiveTradePanel game={liveGame} busy={busy} onCommand={handleGameCommand} />
        </div>
      )}
      <ResourceEffectLayer
        effect={isDevelopmentEffect(activeEffect) ? null : activeEffect}
        onComplete={completeActiveEffect}
        playerName={(playerId) => liveGame?.players.find((player) => player.id === playerId)?.name ?? "玩家"}
      />
      {error === null ? null : <p className="toast-error" role="alert">{error}</p>}
    </main>
  );
}

function readSession(): PlayerSession | null {
  return playerSessionStore.read();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生了未知错误";
}

/**
 * Whether a rejection means this client's copy of the room fell behind.
 *
 * Only then is a refetch worth it. The server compares revisions before it
 * consults the rules, so any other rejection -- not your turn, cannot afford it,
 * that vertex is taken -- proves the local copy already matched the server, and
 * refetching it would only make the player wait a second round trip to be told
 * something the first response already said.
 */
function isStaleStateError(error: unknown): boolean {
  return error instanceof ApiError && ["STALE_REVISION", "STALE_ROOM_REVISION"].includes(error.code);
}

function closeSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true });
    return;
  }

  socket.close();
}
