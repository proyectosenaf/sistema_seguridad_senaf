import { io } from 'socket.io-client';
let socket;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_BASE_URL.replace('/api',''), { transports: ['websocket'] });
  }
  return socket;
}
