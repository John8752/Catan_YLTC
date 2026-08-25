import type { GameCommand, RoomView } from "@catan/protocol";
import { useEffect, useState } from "react";
import {
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
import { LobbySetup } from "./components/LobbySetup.js";
import { PlayerDock } from "./components/PlayerDock.js";
import { RoomPanel } from "./components/RoomPanel.js";
import { ActiveTradePanel } from "./components/ActiveTradePanel.js";
import { Welcome } from "./components/Welcome.js";
import { ResourceEffectLayer } from "./effects/ResourceEffectLayer.js";
import { useGameEffectQueue } from "./effects/use-game-effect-queue.js";
import {
  adoptLegacyTabSession,
  createPlayerSessionStore,
  nextFreeSeatSlot,
  seatSlotFromLocation,
} from "./player-session.js";

adoptLegacyTabSession(window.sessionStorage, window.localStorage);
const seatSlot = seatSlotFromLocation(window.location.search);
const playerSessionStore = createPlayerSessionStore(window.localStorage, seatSlot);
// Driving several seats from one browser is a local-testing need, so the shortcut
// for it only appears there rather than confusing a table of real players.
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);

export function App() {
  const [session, setSession] = useState<PlayerSession | null>(() => readSession());
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "offline">(
    "offline",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buildMode, setBuildMode] = useState<"road" | "settlement" | "city" | null>(null);
  const [selectedRobberHexId, setSelectedRobberHexId] = useState<string | null>(null);
  const { activeEffect, completeActiveEffect } = useGameEffectQueue(room?.game ?? null);

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
      socket = connectToRoom(session, (message) => {
        if (!active) return;

        if (message.type === "room_state") {
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

  async function handleRoomSettingsChange(settings: {
    ruleProfile: "base-3-4" | "extended-5-6";
    playerLimit: 3 | 4 | 5 | 6;
    victoryPointsToWin: number;
  }) {
    if (session === null || room === null || room.game !== null) return;
    await runBusy(async () => {
      try {
        setRoom(await updateRoomSettings(session, room.revision, settings));
      } catch (caught) {
        setRoom(await getRoom(session));
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
        setRoom(await getRoom(session));
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
        setRoom(await getRoom(session));
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

  // A seat cannot be released once the game starts, so this only forgets it here.
  // It is the way out of a finished match, and the price of leaving a live one.
  function handleAbandonSeat() {
    clearCurrentSession();
  }

  function handleOpenExtraSeat() {
    const slot = nextFreeSeatSlot(window.localStorage);
    window.open(`${window.location.pathname}?seat=${slot}`, "_blank", "noopener");
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

  return (
    <main className="game-layout grid min-h-svh grid-cols-1 gap-3 p-3 lg:h-svh lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden">
      <div className="game-brand lg:col-start-1 lg:row-start-1" aria-label="Catan YLTC">
        <span aria-hidden="true">⬡</span>
        <strong>Catan YLTC</strong>
      </div>
      <div className="playfield min-h-[420px] lg:col-start-1 lg:row-start-2 lg:min-h-0">
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
              busy={busy}
              buildMode={buildMode}
              selectedRobberHexId={selectedRobberHexId}
              onCommand={handleGameCommand}
              onRobberHexSelect={handleRobberHexSelect}
            />
            {room.game.phase.kind === "finished" ? (
              <section className="winner-banner" role="status">
                <p className="eyebrow">对局结束</p>
                <h2>{winnerName(room.game)} 获胜</h2>
                <p>率先完成了岛屿建设目标。</p>
              </section>
            ) : null}
          </>
        )}
      </div>
      {room.game === null ? null : (
        <PlayerDock
          game={room.game}
          busy={busy}
          onCommand={handleGameCommand}
          buildMode={buildMode}
          selectedRobberHexId={selectedRobberHexId}
          onBuildModeChange={setBuildMode}
        />
      )}
      <RoomPanel
        room={room}
        playerId={session.playerId}
        connectionState={connectionState}
        busy={busy}
        onStart={handleStart}
        onSettingsChange={handleRoomSettingsChange}
        onLeave={handleLeave}
        onAbandonSeat={handleAbandonSeat}
        onOpenExtraSeat={isLocalHost ? handleOpenExtraSeat : null}
        gamePanel={room.game?.openTrade === null || room.game === null ? null : (
          <ActiveTradePanel game={room.game} busy={busy} onCommand={handleGameCommand} />
        )}
      />
      <ResourceEffectLayer effect={activeEffect} onComplete={completeActiveEffect} />
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

function closeSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.addEventListener("open", () => socket.close(), { once: true });
    return;
  }

  socket.close();
}

function winnerName(game: NonNullable<RoomView["game"]>): string {
  if (game.phase.kind !== "finished") return "玩家";
  const winnerId = game.phase.winnerId;
  return game.players.find((player) => player.id === winnerId)?.name ?? "玩家";
}
