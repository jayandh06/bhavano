import { io, type Socket } from "socket.io-client";

const BFF_URL = process.env.EXPO_PUBLIC_BFF_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(accessToken: string): Socket {
  // Recreate when the session token changes — a singleton opened with the first login kept
  // serving events under a stale `auth` and never re-joined rooms after reconnect.
  if (socket && socketToken !== accessToken) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = accessToken;
    // Force the websocket transport — React Native's XHR polyfill doesn't support
    // socket.io's long-polling fallback transport reliably.
    socket = io(BFF_URL, { auth: { token: accessToken }, transports: ["websocket"] });
  }
  return socket;
}
