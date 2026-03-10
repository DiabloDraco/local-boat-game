const { PHASES, GAME_TYPES } = require('./constants')
const rm = require('./roomManager')
const { validatePlacement, buildBoard, processShot } = require('./gameEngine')
const { createInitialState, applyMove } = require('./checkersEngine')

function roomPlayerById(room, socketId) {
  return room.players.find((p) => p.id === socketId)
}

module.exports = function registerHandlers(io, socket) {
  // ── room:create ────────────────────────────────────────────────────────────
  socket.on('room:create', ({ playerName, gameType }) => {
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const safeGameType = gameType === GAME_TYPES.CHECKERS ? GAME_TYPES.CHECKERS : GAME_TYPES.BATTLESHIP
    const code = rm.createRoom(socket.id, name, safeGameType)
    socket.join(code)
    socket.emit('room:created', { code, role: 'host', gameType: safeGameType })
  })

  // ── room:join ──────────────────────────────────────────────────────────────
  socket.on('room:join', ({ code, playerName, gameType }) => {
    const upperCode = (code || '').trim().toUpperCase()
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const safeGameType = gameType === GAME_TYPES.CHECKERS ? GAME_TYPES.CHECKERS : GAME_TYPES.BATTLESHIP
    const result = rm.joinRoom(upperCode, socket.id, name, safeGameType)

    if (result.error) {
      socket.emit('room:error', { message: result.error })
      return
    }

    const room = result.room
    socket.join(upperCode)

    // Notify guest
    const host = room.players.find((p) => p.role === 'host')
    socket.emit('room:joined', {
      code: upperCode,
      role: 'guest',
      opponentName: host.name,
      gameType: room.gameType,
    })

    // Notify host
    socket.to(upperCode).emit('room:opponent_joined', { opponentName: name, gameType: room.gameType })

    if (room.gameType === GAME_TYPES.BATTLESHIP) {
      // Both players connected → start placement phase
      room.phase = PHASES.PLACEMENT
      io.to(upperCode).emit('game:phase_changed', { phase: PHASES.PLACEMENT })
      return
    }

    // CHECKERS: initialize game immediately when second player joins
    room.phase = PHASES.BATTLE
    room.checkers = createInitialState()
    room.checkersRematch = { host: false, guest: false }
    io.to(upperCode).emit('checkers:start', {
      board: room.checkers.board,
      currentTurn: room.checkers.currentTurn,
      forcedFrom: room.checkers.forcedFrom,
      winner: room.checkers.winner,
    })
  })

  // ── game:place (battleship only) ──────────────────────────────────────────
  socket.on('game:place', ({ ships }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.BATTLESHIP || room.phase !== PHASES.PLACEMENT) return

    const validation = validatePlacement(ships)
    if (!validation.valid) {
      socket.emit('game:placement_error', { message: validation.error })
      return
    }

    room.boards[socket.id] = buildBoard(ships)
    socket.emit('game:placement_ok')

    // Check if both players have placed
    const bothPlaced = room.players.every((p) => room.boards[p.id])
    if (bothPlaced) {
      // Randomly decide who goes first
      const firstPlayer = room.players[Math.floor(Math.random() * 2)]
      room.currentTurn = firstPlayer.id
      room.phase = PHASES.BATTLE
      io.to(room.code).emit('game:battle_start', { firstTurn: firstPlayer.id })
    }
  })

  // ── game:shoot (battleship only) ──────────────────────────────────────────
  socket.on('game:shoot', ({ row, col }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.BATTLESHIP || room.phase !== PHASES.BATTLE) return
    if (room.currentTurn !== socket.id) return

    const opponent = rm.getOpponent(room, socket.id)
    if (!opponent) return

    const targetBoard = room.boards[opponent.id]
    const shotResult = processShot(targetBoard, row, col)

    if (shotResult.result === 'already_shot') return

    // Notify shooter
    socket.emit('game:shot_result', {
      row,
      col,
      result: shotResult.result,
      sunkShip: shotResult.sunkShip || null,
    })

    // Notify target
    socket.to(room.code).emit('game:incoming_shot', {
      row,
      col,
      result: shotResult.result,
      sunkShip: shotResult.sunkShip || null,
    })

    if (shotResult.gameOver) {
      room.phase = PHASES.GAME_OVER
      room.winner = socket.id
      const winnerPlayer = room.players.find((p) => p.id === socket.id)
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

  // ── checkers:move ──────────────────────────────────────────────────────────
  socket.on('checkers:move', (payload) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.CHECKERS || !room.checkers) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = applyMove(room.checkers, player.role, payload)
    if (!result.ok) {
      socket.emit('checkers:error', { message: result.error })
      return
    }

    room.checkers = result.state
    room.checkersRematch = { host: false, guest: false }
    if (result.state.winner) {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === result.state.winner)
      room.winner = winnerPlayer?.id || null
    }

    io.to(room.code).emit('checkers:state', {
      board: room.checkers.board,
      currentTurn: room.checkers.currentTurn,
      forcedFrom: room.checkers.forcedFrom,
      winner: room.checkers.winner,
      lastMove: room.checkers.lastMove,
      captured: result.meta.captured,
      promoted: result.meta.promoted,
      mustContinue: result.meta.mustContinue,
    })
  })

  // ── checkers:rematch ───────────────────────────────────────────────────────
  socket.on('checkers:rematch', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.CHECKERS || !room.checkers) return
    if (room.phase !== PHASES.GAME_OVER || !room.checkers.winner) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    if (!room.checkersRematch) room.checkersRematch = { host: false, guest: false }
    room.checkersRematch[player.role] = true

    io.to(room.code).emit('checkers:rematch_state', {
      hostReady: room.checkersRematch.host,
      guestReady: room.checkersRematch.guest,
    })

    if (!room.checkersRematch.host || !room.checkersRematch.guest) return

    room.phase = PHASES.BATTLE
    room.winner = null
    room.checkers = createInitialState()
    room.checkersRematch = { host: false, guest: false }

    io.to(room.code).emit('checkers:start', {
      board: room.checkers.board,
      currentTurn: room.checkers.currentTurn,
      forcedFrom: room.checkers.forcedFrom,
      winner: room.checkers.winner,
    })
  })

  // ── chat:message ───────────────────────────────────────────────────────────
  socket.on('chat:message', ({ text }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room) return
    const player = room.players.find((p) => p.id === socket.id)
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
