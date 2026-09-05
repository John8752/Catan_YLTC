import { randomBytes } from "node:crypto";
import type { PlayerSessionResponse, RoomView } from "@catan/protocol";
import type { RoomMember, RoomRecord, Subscription } from "./room-types.js";

export class AccountSeats {
  constructor(private readonly rooms: Map<string, RoomRecord>, private readonly subscriptions: Map<string, Set<Subscription>>,
    private readonly project: (room: RoomRecord, playerId: string) => RoomView) {}
  private find(accountId: string): { room: RoomRecord; member: RoomMember } | null {
    for (const room of this.rooms.values()) {
      if (room.game?.phase.kind === "finished") continue;
      const member = room.members.find((member) => member.accountId === accountId);
      if (member) return { room, member };
    }
    return null;
  }
  seat(accountId: string): PlayerSessionResponse | null {
    const found = this.find(accountId);
    if (!found) return null;
    const { room, member } = found;
    return { roomId: room.id, playerId: member.id, seatToken: member.seatToken, room: this.project(room, member.id) };
  }
  prepare(accountId: string, guestSeat?: { readonly roomId: string; readonly seatToken: string }): () => void {
    // May claim a currently held guest seat. A finished match's owners never change.
    let found = this.find(accountId);
    if (!found && guestSeat) {
      const room = this.rooms.get(guestSeat.roomId.trim().toUpperCase());
      const member = room?.members.find((member) => member.accountId === null && member.seatToken === guestSeat.seatToken);
      if (room && member && room.game?.phase.kind !== "finished") found = { room, member };
    }
    const claim = found;
    // Rotate every linked seat, including completed rooms still open in old tabs.
    const seats = [...this.rooms.values()].flatMap((room) => room.members
      .filter((member) => member.accountId === accountId || member === claim?.member)
      .map((member) => ({ room, member, token: randomBytes(24).toString("base64url") })));
    return () => {
      for (const { member, token } of seats) { member.seatToken = token; member.accountId = accountId; }
      for (const { room, member } of seats) {
        const subscriptions = this.subscriptions.get(room.id);
        for (const subscription of subscriptions ?? []) {
          if (subscription.playerId !== member.id) continue;
          subscriptions?.delete(subscription);
          try { subscription.onReplaced?.(); } catch { /* A broken socket cannot abort takeover. */ }
        }
        if (subscriptions?.size === 0) this.subscriptions.delete(room.id);
      }
    };
  }
}
