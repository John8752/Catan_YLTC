import type { RoomRecord } from "./room-types.js";
import type { RoomView, PublicSetupAnalysisView } from "@catan/protocol";
import { buildPublicSetupAnalysisInput, type AiCommentator, type PublicSetupAnalysisInput } from "./ai-commentary.js";
const SETUP_ANALYSIS_RETRY_DELAYS_MS = [1_000, 4_000] as const;
export class RoomSetupAnalysis {
  private readonly setupAnalysisRetries = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;
  constructor(private readonly rooms: Map<string, RoomRecord>, private aiCommentator: AiCommentator | null,
    private readonly projectRoom: (room: RoomRecord, playerId: string) => RoomView,
    private readonly notify: (room: RoomRecord) => void) {}
  configure(value: AiCommentator | null): void { this.aiCommentator = value; }
  dispose(): void { this.disposed = true; for (const id of this.setupAnalysisRetries.keys()) this.cancel(id); }
  start(room: RoomRecord): void {
    if (this.aiCommentator === null || room.game === null || room.publicSetupAnalysis !== null) return;

    const input = buildPublicSetupAnalysisInput(this.projectRoom(room, room.hostPlayerId));
    room.publicSetupAnalysis = { status: "loading", sourceRevision: input.sourceRevision };
    this.runPublicSetupAnalysis(room.id, input, 0);
  }

  /**
   * The job runs once on `setup_completed` and nothing else ever calls it, so a
   * single upstream blip used to cost a room its only opening read for good.
   * Transient failures are retried in place; the room stays on `loading` until
   * the attempts run out, and only then does it settle on `failed`.
   */
  private runPublicSetupAnalysis(
    roomId: string,
    input: PublicSetupAnalysisInput,
    attempt: number,
  ): void {
    const commentator = this.aiCommentator;
    if (commentator === null) return;
    const sourceRevision = input.sourceRevision;

    void commentator.analyzeSetup(input).then(
      (analysis) => this.finishPublicSetupAnalysis(roomId, sourceRevision, {
        status: "ready",
        sourceRevision,
        ...analysis,
      }),
      () => {
        const delay = SETUP_ANALYSIS_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !this.isAwaitingSetupAnalysis(roomId, sourceRevision)) {
          this.finishPublicSetupAnalysis(roomId, sourceRevision, {
            status: "failed",
            sourceRevision,
            message: "AI 开局点评暂时没有生成成功",
          });
          return;
        }

        this.setupAnalysisRetries.set(roomId, setTimeout(() => {
          this.setupAnalysisRetries.delete(roomId);
          if (this.isAwaitingSetupAnalysis(roomId, sourceRevision)) {
            this.runPublicSetupAnalysis(roomId, input, attempt + 1);
          }
        }, delay));
      },
    );
  }

  /** Whether the room is still waiting on the very analysis run that is reporting back. */
  private isAwaitingSetupAnalysis(roomId: string, sourceRevision: number): boolean {
    if (this.disposed) return false;
    const analysis = this.rooms.get(roomId)?.publicSetupAnalysis;
    return analysis?.status === "loading" && analysis.sourceRevision === sourceRevision;
  }

  cancel(roomId: string): void {
    const handle = this.setupAnalysisRetries.get(roomId);
    if (handle === undefined) return;
    clearTimeout(handle);
    this.setupAnalysisRetries.delete(roomId);
  }

  private finishPublicSetupAnalysis(
    roomId: string,
    sourceRevision: number,
    analysis: PublicSetupAnalysisView,
  ): void {
    if (this.disposed) return;
    const room = this.rooms.get(roomId);
    if (
      room === undefined ||
      room.publicSetupAnalysis?.status !== "loading" ||
      room.publicSetupAnalysis.sourceRevision !== sourceRevision
    ) return;

    room.publicSetupAnalysis = analysis;
    room.revision += 1;
    this.notify(room);
  }

}
