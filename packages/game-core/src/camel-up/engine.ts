import { CAMEL_UP_PLAYER_LIMITS } from "./player-limits.js";
import { CamelError, DICE, RACING_CAMELS, type CamelState, type CamelSetup, type CamelCommand, type RollInput, type Face } from "./types.js";
import { moveCamel, rankCamels } from "./movement.js";
function fail(code: string, text: string): never { throw new CamelError(code, text); }
const face = (value: number): value is Face => Number.isInteger(value) && value >= 1 && value <= 3;
export function createCamelUp(id: string, players: readonly { id: string; name: string }[], setup: CamelSetup): CamelState {
  if (!id || players.length < CAMEL_UP_PLAYER_LIMITS.min || players.length > CAMEL_UP_PLAYER_LIMITS.max || new Set(players.map(p => p.id)).size !== players.length) fail("INVALID_SETUP", "骆驼大赛需要 3–6 位不同玩家");
  if (setup.positions.length !== 5 || !setup.positions.every(face) || setup.crazyPositions.length !== 2 || !setup.crazyPositions.every(face) || setup.order.length !== 5 || new Set(setup.order).size !== 5 || !setup.order.every(c => RACING_CAMELS.includes(c))) fail("INVALID_SETUP", "初始化骰子无效");
  const state: CamelState = { id, revision: 0, leg: 1, phase: { kind: "racing", activePlayerId: players[0]!.id },
    players: players.map(({ id, name }) => ({ id, name, coins: 3, tickets: [], pyramidTickets: 0, partnerId: null })),
    stacks: {}, remainingDice: [...DICE], rolls: [], tiles: [], finishBets: [], lastRoll: null, lastLeg: null, effect: null, log: ["沙漠赛场已就绪，比赛开始。"] };
  for (const camel of setup.order) (state.stacks[setup.positions[RACING_CAMELS.indexOf(camel)]!] ??= []).push(camel);
  for (const [index, camel] of (["black", "white"] as const).entries()) (state.stacks[17 - setup.crazyPositions[index]!] ??= []).push(camel);
  return state;
}
export function ticketValues(state: CamelState, id: string): number[] {
  const player = state.players.find(p => p.id === id)!; const rank = rankCamels(state);
  return [...player.tickets.map(t => t.camel === rank[0] ? t.value : t.camel === rank[1] ? 1 : -1), ...Array<number>(player.pyramidTickets).fill(1)];
}
function scoreLeg(state: CamelState) {
  const deltas = state.players.map(p => {
    const partnerBonus = p.partnerId ? Math.max(0, ...ticketValues(state, p.partnerId)) : 0;
    return { playerId: p.id, delta: ticketValues(state, p.id).reduce((a, b) => a + b, 0) + partnerBonus, partnerBonus };
  });
  for (const [index, p] of state.players.entries()) p.coins = Math.max(0, p.coins + deltas[index]!.delta);
  state.lastLeg = { leg: state.leg, ranking: rankCamels(state), deltas };
}
function finish(state: CamelState) {
  const rank = rankCamels(state);
  for (const kind of ["winner", "loser"] as const) {
    let correct = 0; const camel = kind === "winner" ? rank[0] : rank.at(-1);
    for (const bet of state.finishBets.filter(b => b.kind === kind)) {
      const player = state.players.find(p => p.id === bet.playerId)!;
      const reward = bet.camel === camel ? ([8, 5, 3, 2][correct++] ?? 1) : -1;
      player.coins = Math.max(0, player.coins + reward);
    }
  }
  const maximum = Math.max(...state.players.map(p => p.coins));
  state.phase = { kind: "finished", winnerIds: state.players.filter(p => p.coins === maximum).map(p => p.id) };
  state.log.push("比赛结束，赛段与终局投注已结算。");
}
export function availableTileSpaces(state: CamelState, playerId: string): number[] {
  const own = state.tiles.find(t => t.playerId === playerId);
  const other = state.tiles.filter(t => t.playerId !== playerId);
  return Array.from({ length: 15 }, (_, i) => i + 2).filter(space => own?.space !== space && !state.stacks[space]?.length && !other.some(t => Math.abs(t.space - space) <= 1));
}
export function executeCamelUp(state: CamelState, playerId: string, command: CamelCommand, roll?: RollInput): CamelState {
  if (command.matchId !== state.id) fail("STALE_MATCH", "操作属于上一局，请刷新");
  if (command.expectedRevision !== state.revision) fail("STALE_REVISION", "赛场已更新，请重新操作");
  if (state.phase.kind !== "racing") fail("MATCH_FINISHED", "比赛已经结束");
  if (state.phase.activePlayerId !== playerId) fail("NOT_YOUR_TURN", "请等待其他玩家行动");
  const next = JSON.parse(JSON.stringify(state)) as CamelState, player = next.players.find(p => p.id === playerId)!;
  let crossed = false;
  switch (command.type) {
    case "roll": {
      if (!roll || !next.remainingDice.includes(roll.die) || !face(roll.value) || !["black", "white"].includes(roll.crazy)) fail("INVALID_ROLL", "骰子输入无效");
      next.remainingDice = next.remainingDice.filter(d => d !== roll.die); next.rolls.push({ ...roll }); player.pyramidTickets++;
      crossed = moveCamel(next, roll); next.log.push(`${player.name} 摇出 {{camel:${roll.die}}} ${roll.value}，移动至第 ${next.lastRoll!.to} 格。`); break;
    }
    case "ticket": {
      if (!RACING_CAMELS.includes(command.camel)) fail("INVALID_CAMEL", "请选择赛骆驼");
      const count = next.players.reduce((n, p) => n + p.tickets.filter(t => t.camel === command.camel).length, 0);
      const value = [5, 3, 2, 2][count]; if (!value) fail("NO_TICKETS", "这叠赛段票已领完");
      player.tickets.push({ camel: command.camel, value }); next.log.push(`${player.name} 领取 {{camel:${command.camel}}} 的 ${value} 金币赛段票。`); break;
    }
    case "tile": {
      if (!availableTileSpaces(state, playerId).includes(command.space) || !["cheer", "boo"].includes(command.side)) fail("INVALID_TILE", "请选择空格，避开第 1 格及其他观众牌的相邻格");
      next.tiles = next.tiles.filter(t => t.playerId !== playerId); next.tiles.push({ playerId, space: command.space, side: command.side });
      next.log.push(`${player.name} 在第 ${command.space} 格放置${command.side === "cheer" ? "欢呼" : "倒彩"}牌。`); break;
    }
    case "finish-bet": {
      if (!RACING_CAMELS.includes(command.camel) || !["winner", "loser"].includes(command.kind)) fail("INVALID_BET", "终局卡无效");
      if (next.finishBets.some(b => b.playerId === playerId && b.camel === command.camel)) fail("CARD_USED", "这张颜色的终局卡已经用过");
      next.finishBets.push({ playerId, camel: command.camel, kind: command.kind }); next.log.push(`${player.name} 暗投了总${command.kind === "winner" ? "冠军" : "末名"}。`); break;
    }
    case "partner": {
      const partner = next.players.find(p => p.id === command.playerId);
      if (next.players.length < 6 || player.partnerId || !partner || partner === player || partner.partnerId) fail("INVALID_PARTNER", "请选择本赛段尚未合伙的其他玩家（六人局）");
      player.partnerId = partner.id; partner.partnerId = player.id; next.log.push(`${player.name} 与 ${partner.name} 成为本段合伙人。`); break;
    }
    default: fail("INVALID_COMMAND", "未知行动");
  }
  if (crossed || next.rolls.length === 5) {
    scoreLeg(next);
    if (crossed) finish(next);
    else {
      next.log.push(`第 ${next.leg} 赛段已结算。`); next.leg++; next.remainingDice = [...DICE]; next.rolls = []; next.tiles = [];
      for (const p of next.players) { p.tickets = []; p.pyramidTickets = 0; p.partnerId = null; }
    }
  }
  if (next.phase.kind !== "finished") next.phase = { kind: "racing", activePlayerId: next.players[(next.players.findIndex(p => p.id === playerId) + 1) % next.players.length]!.id };
  next.revision++;
  next.effect = { revision: next.revision, playerId, type: command.type,
    camel: command.type === "roll" ? next.lastRoll!.camel : command.type === "ticket" ? command.camel : null,
    space: command.type === "roll" ? next.lastRoll!.to : command.type === "tile" ? command.space : null,
    value: command.type === "roll" ? roll!.value : null, betKind: command.type === "finish-bet" ? command.kind : null,
    legEnded: crossed || (command.type === "roll" && next.leg !== state.leg), finished: next.phase.kind === "finished" };
  next.log = next.log.slice(-60); return next;
}
