const { PHASES } = require('./constants')
const rm = require('./roomManager')
const { validatePlacement, buildBoard, processShot } = require('./gameEngine')

module.exports = function registerHandlers(io, socket) {
  // ── room:create ────────────────────────────────────────────────────────────
  socket.on('room:create', ({ playerName }) => {
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const code = rm.createRoom(socket.id, name)
    socket.join(code)
    socket.emit('room:created', { code, role: 'host' })
  })

  // ── room:join ──────────────────────────────────────────────────────────────
  socket.on('room:join', ({ code, playerName }) => {
    const upperCode = (code || '').trim().toUpperCase()
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const result = rm.joinRoom(upperCode, socket.id, name)

    if (result.error) {
      socket.emit('room:error', { message: result.error })
      return
    }

    const room = result.room
    socket.join(upperCode)

    // Notify guest
    const host = room.players.find(p => p.role === 'host')
    socket.emit('room:joined', { code: upperCode, role: 'guest', opponentName: host.name })

    // Notify host
    socket.to(upperCode).emit('room:opponent_joined', { opponentName: name })

    // Both players connected → start placement phase
    room.phase = PHASES.PLACEMENT
    io.to(upperCode).emit('game:phase_changed', { phase: PHASES.PLACEMENT })
  })

  // ── game:place ─────────────────────────────────────────────────────────────
  socket.on('game:place', ({ ships }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.phase !== PHASES.PLACEMENT) return

    const validation = validatePlacement(ships)
    if (!validation.valid) {
      socket.emit('game:placement_error', { message: validation.error })
      return
    }

    room.boards[socket.id] = buildBoard(ships)
    socket.emit('game:placement_ok')

    // Check if both players have placed
    const bothPlaced = room.players.every(p => room.boards[p.id])
    if (bothPlaced) {
      // Randomly decide who goes first
      const firstPlayer = room.players[Math.floor(Math.random() * 2)]
      room.currentTurn = firstPlayer.id
      room.phase = PHASES.BATTLE
      io.to(room.code).emit('game:battle_start', { firstTurn: firstPlayer.id })
    }
  })

  // ── game:shoot ─────────────────────────────────────────────────────────────
  socket.on('game:shoot', ({ row, col }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.phase !== PHASES.BATTLE) return
    if (room.currentTurn !== socket.id) return

    const opponent = rm.getOpponent(room, socket.id)
    if (!opponent) return

    const targetBoard = room.boards[opponent.id]
    const shotResult = processShot(targetBoard, row, col)

    if (shotResult.result === 'already_shot') return

    // Notify shooter
    socket.emit('game:shot_result', {
      row, col,
      result: shotResult.result,
      sunkShip: shotResult.sunkShip || null,
    })

    // Notify target
    socket.to(room.code).emit('game:incoming_shot', {
      row, col,
      result: shotResult.result,
      sunkShip: shotResult.sunkShip || null,
    })

    if (shotResult.gameOver) {
      room.phase = PHASES.GAME_OVER
      room.winner = socket.id
      const winnerPlayer = room.players.find(p => p.id === socket.id)
      io.to(room.code).emit('game:over', {
        winner: socket.id,
        winnerName: winnerPlayer.name,
      })
      return
    }

    // If miss, switch turn; if hit/sunk, same player continues
    if (shotResult.result === 'miss') {
      room.currentTurn = opponent.id
      io.to(room.code).emit('game:turn_changed', { currentTurn: opponent.id })
    }
  })

  // ── chat:message ───────────────────────────────────────────────────────────
  socket.on('chat:message', ({ text }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room) return
    const player = room.players.find(p => p.id === socket.id)
    if (!player) return
    const clean = (text || '').trim().slice(0, 200)
    if (!clean) return
    io.to(room.code).emit('chat:incoming', { from: player.name, fromId: socket.id, text: clean })
  })

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const room = rm.removePlayer(socket.id)
    if (room && room.players.length > 0) {
      io.to(room.code).emit('room:opponent_left')
    }
  })
}
