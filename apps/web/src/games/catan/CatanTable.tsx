import { useEffect, useState, type ReactNode } from "react";
import type { PlayerColor } from "@catan/game-core/catan";
import type { AnyRoomView, GameCommand, RoomSettingsInput, RoomView } from "@catan/protocol";
import { useRoomHistory } from "../../hooks/use-room-history.js";
import type { RoomUpdates } from "../../room-updates.js";
import { ApiError, getCatanRoom as getRoom, rerollRoomMap, shuffleRoomMembers, submitGameCommand, updatePlayerColor, updateRoomSettings, type PlayerSession } from "../../api.js";
import { Board } from "../../components/Board.js";
import { BankSupply } from "../../components/BankSupply.js";
import { BankSupplyButton } from "../../components/BankSupplyButton.js";
import { ResponsiveRoomPanel } from "../../components/ResponsiveRoomPanel.js";
import { useMediaQuery } from "../../hooks/use-media-query.js";
import { GameResult } from "../../components/GameResult.js";
import { LobbySetup } from "../../components/LobbySetup.js";
import { GameSidebar } from "../../components/GameSidebar.js";
import { OpponentStrip } from "../../components/OpponentStrip.js";
import { TurnForecastBar } from "../../components/TurnForecastBar.js";
import { TableUtilities } from "../../components/TableUtilities.js";
import { PlayerDock } from "../../components/PlayerDock.js";
import { RoomPanel } from "../../components/RoomPanel.js";
import { ActiveTradePanel } from "../../components/ActiveTradePanel.js";
import { AiCommentaryControl } from "../../components/AiCommentaryControl.js";
import { ResourceEffectLayer } from "../../effects/ResourceEffectLayer.js";
import { DevelopmentEffectLayer, isDevelopmentEffect } from "../../effects/DevelopmentEffectLayer.js";
import { useGameEffectQueue } from "../../effects/use-game-effect-queue.js";
import { useActionAttention } from "../../effects/use-action-attention.js";
import { useVictoryWarnings } from "../../effects/use-victory-warnings.js";
import { useGameSounds } from "../../effects/use-game-sounds.js";
import { SoundControl } from "../../components/SoundControl.js";
import { canRetryStaleTradeCommand } from "../../lib/trade-command-retry.js";

interface Props {
  readonly room: RoomView;
  readonly session: PlayerSession;
  readonly updates: RoomUpdates;
  readonly busy: boolean;
  readonly error: string | null;
  readonly connectionState: "connecting" | "live" | "offline";
  readonly snapshotEpoch: number;
  readonly accountControl: ReactNode;
  readonly compactAccountControl: ReactNode;
  readonly setRoom: (room: AnyRoomView) => void;
  readonly runBusy: (action: () => Promise<void>) => Promise<void>;
  readonly handleStart: () => Promise<void>;
  readonly handleLeave: () => Promise<void>;
  readonly handleDisband: () => Promise<void>;
  readonly onReturnToLobby: () => Promise<void>;
}
export function CatanTable({ room, session, updates, busy, error, connectionState, snapshotEpoch, accountControl, compactAccountControl, setRoom, runBusy, handleStart, handleLeave, handleDisband, onReturnToLobby }: Props) {
  const bankInSidebar = useMediaQuery("(min-width: 1024px)");
  const [boardInfoHost, setBoardInfoHost] = useState<HTMLDivElement | null>(null);
  const historyControls = useRoomHistory(session, room, updates);
  const [buildMode, setBuildMode] = useState<"road" | "settlement" | "city" | null>(null);
  const [selectedRobberHexId, setSelectedRobberHexId] = useState<string | null>(null);
  // Where the AI said someone is heading, parked here so the dialog can close
  // and leave the board pointing at it.
  const [intentFocusVertexId, setIntentFocusVertexId] = useState<string | null>(null);
  const { activeEffect, completeActiveEffect } = useGameEffectQueue(room?.game ?? null, snapshotEpoch);
  const actionNotice = useActionAttention(room?.game ?? null, snapshotEpoch, connectionState === "live");
  const sound = useGameSounds(room?.game ?? null, snapshotEpoch, connectionState === "live");
  const victoryNotice = useVictoryWarnings(room?.game ?? null, snapshotEpoch, connectionState === "live", actionNotice !== null);

  // A read goes stale the moment anyone builds, so the marker does not outlive
  // the position it was describing.
  const boardRevision = room?.game?.revision ?? null;
  useEffect(() => setIntentFocusVertexId(null), [boardRevision]);

  useEffect(() => {
    setBuildMode(null);
    setSelectedRobberHexId(null);
  }, [room?.game?.revision]);


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

  async function handlePlayerColorChange(color: PlayerColor) {
    if (session === null || room === null || room.game !== null) return;
    await runBusy(async () => {
      try {
        setRoom(await updatePlayerColor(session, room.revision, color));
      } catch (caught) {
        if (isStaleStateError(caught)) setRoom(await getRoom(session));
        throw caught;
      }
    });
  }

  async function handleShufflePlayers() {
    if (session === null || room === null || room.game !== null) return;
    await runBusy(async () => {
      try {
        setRoom(await shuffleRoomMembers(session, room.revision));
      } catch (caught) {
        if (isStaleStateError(caught)) setRoom(await getRoom(session));
        throw caught;
      }
    });
  }

  async function handleGameCommand(command: GameCommand) {
    const submittedGame = room?.game;
    if (session === null || submittedGame === null || submittedGame === undefined) return;
    await runBusy(async () => {
      try {
        const response = await submitGameCommand(session, submittedGame.revision, command, submittedGame.id);
        await updates.confirm(response, session, (after) => getRoom(session, after), connectionState === "live");
      } catch (caught) {
        if (isStaleStateError(caught)) {
          const latestRoom = await getRoom(session);
          setRoom(latestRoom);
          if (
            latestRoom.game !== null &&
            canRetryStaleTradeCommand(command, submittedGame, latestRoom.game, session.playerId)
          ) {
            const response = await submitGameCommand(session, latestRoom.game.revision, command, latestRoom.game.id);
            await updates.confirm(response, session, (after) => getRoom(session, after), connectionState === "live");
            return;
          }
        }
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


  const liveGame = room.game;
  // Route one bank/effect anchor to its current surface; do not mount hidden copies.
  const bankSupply = liveGame === null ? null : bankInSidebar
    ? <BankSupply resources={liveGame.bankResources} className="mr-0 w-full shrink-0 justify-center border-transparent bg-transparent shadow-none backdrop-blur-none lg:rounded-none lg:[&>span]:bg-white/5 lg:[&>span]:text-[var(--game-rail-muted)]" />
    : <BankSupplyButton resources={liveGame.bankResources} effectAnchor={false} />;
  const aiControl = liveGame === null ? null : <AiCommentaryControl compact={!bankInSidebar}
      session={session}
      revision={liveGame.revision}
      turnNumber={liveGame.phase.kind === "turn" ? liveGame.phase.turnNumber : null}
      setupAnalysis={room.setupAnalysis}
      players={room.members}
      onFocusVertex={setIntentFocusVertexId}
    />;
  const roomControls = <ResponsiveRoomPanel {...historyControls}
    room={room} playerId={session.playerId} connectionState={connectionState} busy={busy}
    onStart={handleStart} onSettingsChange={handleRoomSettingsChange}
    onPlayerColorChange={handlePlayerColorChange} onShufflePlayers={handleShufflePlayers}
    onLeave={handleLeave} onDisband={handleDisband}
    embedded showPlayers={false} className="min-h-0 flex-1"
    headerAction={bankInSidebar ? aiControl : null}
  />;

  return (
    <main className={liveGame === null
      ? "game-layout grid min-h-svh grid-cols-1 gap-3 p-3 lg:h-svh lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:overflow-hidden"
      : "game-layout live-game-layout grid h-dvh min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 overflow-hidden p-[max(.35rem,env(safe-area-inset-top),env(safe-area-inset-bottom),env(safe-area-inset-left),env(safe-area-inset-right))] phone-landscape:grid-cols-[minmax(0,1fr)_14rem] phone-landscape:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_var(--game-rail-width)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-3 lg:p-[max(.75rem,env(safe-area-inset-top),env(safe-area-inset-bottom),env(safe-area-inset-left),env(safe-area-inset-right))] xl:grid-cols-[var(--game-opponent-width)_minmax(0,1fr)_var(--game-rail-width)] xl:grid-rows-[minmax(0,1fr)]"}>
      {liveGame === null ? <div className="game-brand lg:col-start-1 lg:row-start-1" aria-label="Catan YLTC">
        <span aria-hidden="true">⬡</span>
        <strong>Catan YLTC</strong>
        {accountControl}
      </div> : null}
      {liveGame === null ? null : (
        <div className="seat-column col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col gap-1 phone-landscape:col-span-2 xl:min-h-0">
          <TurnForecastBar
            compact={!bankInSidebar}
            game={liveGame}
            actions={<TableUtilities
              compact={!bankInSidebar}
              tools={<>{bankSupply}{roomControls}</>}
              persistentControl={aiControl}
              soundControl={<SoundControl {...sound} />}
              accountControl={compactAccountControl}
              room={room}
              playerId={session.playerId}
              busy={busy}
              onDisband={handleDisband}
            />}
          />
          <OpponentStrip game={liveGame} />
        </div>
      )}
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
              toolsInMenu
              infoHost={bankInSidebar ? boardInfoHost : null}
              actionNotice={actionNotice}
              victoryNotice={victoryNotice}
              bankSupply={null}
              busy={busy}
              buildMode={buildMode}
              selectedRobberHexId={selectedRobberHexId}
              intentFocusVertexId={intentFocusVertexId}
              onCommand={handleGameCommand}
              onRobberHexSelect={handleRobberHexSelect}
            />
            <DevelopmentEffectLayer
              effect={isDevelopmentEffect(activeEffect) ? activeEffect : null}
              currentPlayerId={session.playerId}
              playerName={(playerId) => liveGame?.players.find((player) => player.id === playerId)?.name ?? "玩家"}
              onComplete={completeActiveEffect}
            />
            {room.game.phase.kind === "finished" && activeEffect === null ? <GameResult game={room.game} onReplay={room.hostPlayerId === session.playerId ? onReturnToLobby : undefined} busy={busy} /> : null}
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
        onPlayerColorChange={handlePlayerColorChange}
        onShufflePlayers={handleShufflePlayers}
        onLeave={handleLeave} onDisband={handleDisband}
      /> : <GameSidebar
        bankSupply={bankInSidebar ? bankSupply : null}
        roomControls={bankInSidebar ? roomControls : null}
        onInfoMount={setBoardInfoHost}
      >
        <PlayerDock
          tradePanel={!bankInSidebar && liveGame.openTrade ? <ActiveTradePanel game={liveGame} busy={busy} onCommand={handleGameCommand} compact /> : null}
          game={liveGame}
          compact={!bankInSidebar}
          busy={busy}
          onCommand={handleGameCommand}
          buildMode={buildMode}
          selectedRobberHexId={selectedRobberHexId}
          onBuildModeChange={setBuildMode}
        />
      </GameSidebar>}
      {!bankInSidebar || liveGame?.openTrade === null || liveGame === null ? null : (
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

function isStaleStateError(error: unknown): boolean {
  return error instanceof ApiError && ["STALE_REVISION", "STALE_ROOM_REVISION"].includes(error.code);
}
