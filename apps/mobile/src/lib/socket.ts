import { io, type Socket } from "socket.io-client";

const BFF_URL = process.env.EXPO_PUBLIC_BFF_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(accessToken: string): Socket {
  if (!socket) {
    // Force the websocket transport — React Native's XHR polyfill doesn't support
    // socket.io's long-polling fallback transport reliably.
    socket = io(BFF_URL, { auth: { token: accessToken }, transports: ["websocket"] });
  }
  return socket;
}
