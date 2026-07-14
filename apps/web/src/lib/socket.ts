import { io, type Socket } from "socket.io-client";

// The browser connects directly here (see NEXT_PUBLIC_BFF_URL note in .env) — a
// deliberate, narrow exception to "no direct browser->BFF calls" for the persistent
// WebSocket connection only; all data fetching/mutation still goes through the server.
let socket: Socket | null = null;

export function getSocket(accessToken: string): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BFF_URL ?? "http://localhost:4000", {
      auth: { token: accessToken },
    });
  }
  return socket;
}
