/**
 * Single choke point for every Terminal Echo real-time broadcast.
 *
 * MERGE_HARDENING_PLAN.md Blocker 1: creation, reactions, replies, and
 * reply-reactions each used to build their own `airport:<IATA>` room
 * string (or skip scoping entirely) at their own call site. That let
 * three of the four paths silently regress to namespace-wide broadcast
 * — this helper is the only place a room is derived, so there's one
 * place left to get it right.
 *
 * Fail-safe invariant: if no canonical airport can be resolved, the
 * event is dropped rather than broadcast to the whole namespace. A
 * client that never learns about an echo it can't be scoped to is
 * preferable to every connected client, at every airport, receiving
 * every event.
 */

import { Server } from "socket.io";

export function airportRoom(airportIata?: string | null): string | null {
  const iata = (airportIata || "").trim().toUpperCase();
  return iata ? `airport:${iata}` : null;
}

export function broadcastToAirportRoom(
  io: Server,
  airportIata: string | null | undefined,
  event: string,
  payload: unknown
): void {
  const room = airportRoom(airportIata);
  if (!room) {
    console.warn(
      `[terminal-echo broadcast] Skipped "${event}" — no canonical airport could be resolved; refusing to broadcast namespace-wide.`
    );
    return;
  }
  io.of("/terminal-echo").to(room).emit(event, payload);
}
