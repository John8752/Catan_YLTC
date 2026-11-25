import type { PokerEffect, PokerView } from "@catan/protocol/texas-holdem";
/** Initial/reconnected snapshots establish a baseline; only new live transitions animate. */
export class PokerMotionCursor {
  private initialized = false;
  private match: string | null = null;
  private revision = 0;
  private epoch = 0;
  private hand = 0;
  consume(game: PokerView | null, epoch: number): { effects: PokerEffect[]; reset: boolean } {
    if (this.initialized && game?.id === this.match && epoch === this.epoch && game.revision <= this.revision) return { effects: [], reset: false };
    const baseline = !this.initialized || this.epoch !== epoch || (this.match !== null && game?.id !== this.match);
    const oldRevision = this.revision;
    const newHand = this.match === game?.id && this.hand !== game?.handNumber;
    this.initialized = true; this.epoch = epoch;
    if (!game) { this.match = null; this.revision = 0; this.hand = 0; return { effects: [], reset: true }; }
    this.hand = game.handNumber;
    this.match = game.id; this.revision = Math.max(game.revision, baseline ? 0 : oldRevision);
    return { effects: baseline || game.revision <= oldRevision ? [] : game.effects, reset: baseline || newHand };
  }
}
