import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { AccountView, AuthResponse, AnyRoomView, GameType } from "@catan/protocol/platform";
import { getAccount } from "./auth-api.js";
import { setAccountCsrf } from "./auth-headers.js";
import { AccountControl } from "./components/AccountControl.js";
import { Welcome } from "./components/Welcome.js";
import { createGameRoomPolicy } from "./games/room-sync.js";
import { RoomUpdates, RoomSessionChangedError } from "./room-updates.js";
import { useRoomConnection } from "./hooks/use-room-connection.js";
import { ApiError } from "./http.js";
import { createRoom, joinRoom, startRoom, leaveRoom, disbandRoom, returnToLobby } from "./api.js";
import { type PlayerSession } from "./room-session.js";
import { adoptLegacyTabSession, createPlayerSessionStore, seatSlotFromLocation } from "./player-session.js";

adoptLegacyTabSession(window.sessionStorage, window.localStorage);
const playerSessionStore = createPlayerSessionStore(window.localStorage, seatSlotFromLocation(window.location.search));
const CatanTable = lazy(() => import("./games/catan/CatanTable.js").then((module) => ({ default: module.CatanTable })));
const DrawGuessTable = lazy(() => import("./games/draw-guess/DrawGuessTable.js").then((module) => ({ default: module.DrawGuessTable })));

/** Account, room and connection shell. Game-specific controls live in games/<gameId>. */
export function App() {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<PlayerSession | null>(() => playerSessionStore.read());
  const [room, renderRoom] = useState<AnyRoomView | null>(null);
  const [updates] = useState(() => new RoomUpdates(session, renderRoom, createGameRoomPolicy));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const { connectionState, snapshotEpoch } = useRoomConnection(session, authReady, updates, {
    onSynced: () => setError(null),
    onError: (caught) => setError(errorMessage(caught)),
    onClosed: (reason, message) => { if (reason === "account_session_replaced") clearAccount(); else clearCurrentSession(); setError(message); },
    onInvalidSeat: (message) => { clearAccount(); setError(message); },
  });
  useEffect(() => {
    let active = true;
    void getAccount().then((response) => { if (active && response) installAccount(response); })
      .catch(() => { /* Accounts are optional. */ }).finally(() => active && setAuthReady(true));
    return () => { active = false; };
  }, []);
  function installAccount(response: AuthResponse) {
    setAccount(response.account); setAccountCsrf(response.csrfToken);
    if (response.activeSeat) { const { roomId, playerId, seatToken, room: view } = response.activeSeat;
      storeSession({ roomId, playerId, seatToken }); updates.accept(view, { roomId, playerId, seatToken }); }
  }
  function clearAccount() { setAccount(null); setAccountCsrf(null); clearCurrentSession(); }
  function clearCurrentSession() { playerSessionStore.clear(); setSession(null); updates.reset(null); setError(null); }
  function storeSession(next: PlayerSession) { updates.reset(next); playerSessionStore.write(next); setSession(next); }
  function setRoom(view: AnyRoomView) { if (session) updates.accept(view, session); }
  async function runBusy(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    try { await action(); }
    catch (caught) {
      if (caught instanceof RoomSessionChangedError) return;
      if (caught instanceof ApiError && caught.code === "AUTH_REQUIRED") clearAccount();
      setError(errorMessage(caught));
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function handleCreate(name: string, gameId: GameType) {
    await runBusy(async () => { const next = await createRoom(name, gameId);
      storeSession({ roomId: next.roomId, playerId: next.playerId, seatToken: next.seatToken }); updates.accept(next.room, next); });
  }
  async function handleJoin(id: string, name: string) {
    await runBusy(async () => { const next = await joinRoom(id, name);
      storeSession({ roomId: next.roomId, playerId: next.playerId, seatToken: next.seatToken }); updates.accept(next.room, next); });
  }
  async function handleStart() { if (session) await runBusy(async () => setRoom(await startRoom(session))); }
  async function handleLeave() { if (session) await runBusy(async () => { await leaveRoom(session); clearCurrentSession(); }); }
  async function handleDisband() { if (session) await runBusy(async () => { await disbandRoom(session); clearCurrentSession(); }); }
  async function handleReplay() { if (session && room?.matchId) await runBusy(async () => setRoom(await returnToLobby(session, room.matchId!))); }
  const accountControl = <AccountControl account={account} session={session} onLogin={installAccount} onLogout={clearAccount} onProfile={setAccount} />;
  const compactAccountControl = <AccountControl compact account={account} session={session} onLogin={installAccount} onLogout={clearAccount} onProfile={setAccount} />;
  if (!session) return <Welcome busy={busy || !authReady} error={error} onCreate={handleCreate} onJoin={handleJoin} accountControl={accountControl} defaultPlayerName={account?.displayName ?? ""} />;
  if (!room) return <main className="loading-table"><span className="brand-mark" aria-hidden="true">⬡</span><p>{error ?? "正在重新铺好桌面…"}</p>
    <button className="quiet-button" type="button" onClick={clearCurrentSession}>清除失效会话并返回</button></main>;
  const common = { session, busy, error, connectionState, accountControl, setRoom, runBusy, handleStart, handleLeave, handleDisband, onReturnToLobby: handleReplay };
  return <Suspense fallback={<main className="loading-table"><p role="status">正在准备游戏桌面…</p></main>}>{room.gameId === "catan"
    ? <CatanTable key={room.id} {...common} room={room} updates={updates} snapshotEpoch={snapshotEpoch} compactAccountControl={compactAccountControl} />
    : <DrawGuessTable key={room.id} {...common} room={room} />}</Suspense>;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "发生了未知错误"; }
