import { io } from 'socket.io-client'

// Auto-detect server URL:
// - If .env VITE_SERVER_URL is set — use it
// - If page opened by LAN IP (e.g. 192.168.1.5:5173) — use same host on port 3001
// - Otherwise localhost:3001
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  `http://${window.location.hostname}:3001`

const socket = io(SERVER_URL, {
  autoConnect: false,
})

export default socket
