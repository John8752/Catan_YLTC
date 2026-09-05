import type { AccountMatchRecord, MatchHistoryResponse, MatchRecord } from "@catan/protocol";
import type { SqliteDatabase } from "./sqlite-database.js";

export interface MatchParticipant { readonly accountId: string; readonly playerId: string }
export interface MatchRepository {
  save(record: MatchRecord, participants: readonly MatchParticipant[]): void;
  history(accountId: string, gameId: string, offset: number, limit: number): MatchHistoryResponse;
}
export class SqliteMatchRepository implements MatchRepository {
  constructor(private readonly database: SqliteDatabase) {}
  save(record: MatchRecord, participants: readonly MatchParticipant[]): void {
    if (participants.length === 0) return;
    this.database.transaction(() => {
      const inserted = this.database.db.prepare("INSERT INTO match_results VALUES(?,?,?,?,?,?) ON CONFLICT(game_id, match_id) DO NOTHING")
        .run(record.gameId, record.matchId, record.dataVersion, record.startedAt, record.finishedAt, JSON.stringify(record.data));
      if (inserted.changes === 0) return; // Final snapshots and their ownership are immutable.
      const statement = this.database.db.prepare("INSERT INTO account_matches VALUES(?,?,?,?)");
      for (const participant of participants) statement.run(participant.accountId, record.gameId, record.matchId, participant.playerId);
    });
  }
  history(accountId: string, gameId: string, offset: number, limit: number): MatchHistoryResponse {
    const rows = this.database.db.prepare(`SELECT r.*, a.player_id FROM account_matches a JOIN match_results r
      ON a.game_id=r.game_id AND a.match_id=r.match_id WHERE a.account_id=? AND a.game_id=?
      ORDER BY r.finished_at DESC, r.match_id DESC LIMIT ? OFFSET ?`).all(accountId, gameId, limit + 1, offset);
    const matches: AccountMatchRecord[] = rows.slice(0, limit).map((row) => ({
      gameId: String(row.game_id), matchId: String(row.match_id), dataVersion: Number(row.data_version),
      startedAt: Number(row.started_at), finishedAt: Number(row.finished_at), playerId: String(row.player_id),
      data: JSON.parse(String(row.data_json)) as unknown,
    }));
    return { matches, nextOffset: rows.length > limit ? offset + limit : null };
  }
}
