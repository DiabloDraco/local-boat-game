require('dotenv').config()
const express = require('express')
const http    = require('http')
const { Server } = require('socket.io')
const os = require('os')
const registerHandlers = require('./socketHandler')

const app    = express()
const server = http.createServer(app)
const io     = new Server(server, {
  cors: { origin: '*' }
})

app.get('/health', (_, res) => res.json({ ok: true }))

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`)
  registerHandlers(io, socket)
  socket.on('disconnect', () => console.log(`[-] Disconnected: ${socket.id}`))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚢  Морской Бой сервер запущен`)
  console.log(`   localhost:  http://localhost:${PORT}`)

  // Print all LAN IPs
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   LAN:        http://${net.address}:${PORT}`)
      }
    }
  }
  console.log()
})
