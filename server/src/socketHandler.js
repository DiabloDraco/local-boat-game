const { PHASES, GAME_TYPES } = require('./constants')
const rm = require('./roomManager')
const { validatePlacement, buildBoard, processShot } = require('./gameEngine')
const { createInitialState, applyMove } = require('./checkersEngine')
const { createInitialState: createTttState, applyMove: applyTttMove } = require('./ticTacToeEngine')
const { createInitialState: createDurakState, applyPlay: applyDurakPlay, applyDone: applyDurakDone, applyTake: applyDurakTake } = require('./durakEngine')
const { createInitialState: createHangmanState, setWord: setHangmanWord, guessLetter: guessHangmanLetter } = require('./hangmanEngine')

function roomPlayerById(room, socketId) {
  return room.players.find((p) => p.id === socketId)
}

function durakViewForRole(state, role) {
  const opponentRole = role === 'host' ? 'guest' : 'host'
  const pairs = state.table.attacks.map((attack, i) => ({
    attack,
    defend: state.table.defends[i] || null,
  }))

  return {
    role,
    hand: state.hands[role],
    opponentCount: state.hands[opponentRole].length,
    deckCount: state.deck.length,
    trumpSuit: state.trumpSuit,
    trumpCard: state.trumpCard,
    attackerRole: state.attackerRole,
    defenderRole: state.defenderRole,
    phase: state.phase,
    table: {
      attacks: state.table.attacks,
      defends: state.table.defends,
      pairs,
    },
    winner: state.winner,
    draw: state.draw,
  }
}

function emitDurakState(io, room, eventName = 'durak:state') {
  for (const player of room.players) {
    io.to(player.id).emit(eventName, durakViewForRole(room.durak, player.role))
  }
}

function hangmanViewForRole(state, role) {
  const isSetter = role === state.setterRole
  const wordRevealed = state.phase === 'set_word' || state.phase === 'finished'
  return {
    role,
    round: state.round,
    phase: state.phase,
    setterRole: state.setterRole,
    guesserRole: state.guesserRole,
    maskedWord: state.masked.join(' '),
    guessedLetters: state.guessedLetters,
    wrongLetters: state.wrongLetters,
    wrongCount: state.wrongCount,
    maxWrong: state.maxWrong,
    scores: state.scores,
    winner: state.winner,
    draw: state.draw,
    secretWord: isSetter || wordRevealed ? state.secretWord : null,
  }
}

function emitHangmanState(io, room, eventName = 'hangman:state') {
  for (const player of room.players) {
    io.to(player.id).emit(eventName, hangmanViewForRole(room.hangman, player.role))
  }
}

module.exports = function registerHandlers(io, socket) {
  function broadcastRoomList(gameType) {
    io.emit('room:list_changed', { gameType, rooms: rm.listRooms(gameType) })
  }

  function parseGameType(type) {
    if (type === GAME_TYPES.CHECKERS) return GAME_TYPES.CHECKERS
    if (type === GAME_TYPES.TIC_TAC_TOE) return GAME_TYPES.TIC_TAC_TOE
    if (type === GAME_TYPES.DURAK) return GAME_TYPES.DURAK
    if (type === GAME_TYPES.HANGMAN_DUEL) return GAME_TYPES.HANGMAN_DUEL
    return GAME_TYPES.BATTLESHIP
  }

  // ── room:create ────────────────────────────────────────────────────────────
  socket.on('room:create', ({ playerName, gameType, roomName, visibility, password }) => {
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const safeGameType = parseGameType(gameType)
    const code = rm.createRoom(socket.id, name, safeGameType, {
      roomName,
      visibility,
      password,
    })
    const room = rm.getRoom(code)
    socket.join(code)
    socket.emit('room:created', {
      code,
      role: 'host',
      gameType: safeGameType,
      roomName: room.roomName,
      visibility: room.visibility,
    })
    broadcastRoomList(safeGameType)
  })

  // ── room:list ──────────────────────────────────────────────────────────────
  socket.on('room:list', ({ gameType }) => {
    const safeGameType = parseGameType(gameType)
    socket.emit('room:list', { gameType: safeGameType, rooms: rm.listRooms(safeGameType) })
  })

  // ── room:join ──────────────────────────────────────────────────────────────
  socket.on('room:join', ({ code, playerName, gameType, password }) => {
    const upperCode = (code || '').trim().toUpperCase()
    const name = (playerName || 'Игрок').trim().slice(0, 24)
    const safeGameType = parseGameType(gameType)
    const result = rm.joinRoom(upperCode, socket.id, name, safeGameType, password)

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
      broadcastRoomList(room.gameType)
      return
    }

    if (room.gameType === GAME_TYPES.CHECKERS) {
      room.phase = PHASES.BATTLE
      room.checkers = createInitialState()
      room.checkersRematch = { host: false, guest: false }
      io.to(upperCode).emit('checkers:start', {
        board: room.checkers.board,
        currentTurn: room.checkers.currentTurn,
        forcedFrom: room.checkers.forcedFrom,
        winner: room.checkers.winner,
      })
      broadcastRoomList(room.gameType)
      return
    }

    // TIC-TAC-TOE: initialize game immediately when second player joins
    room.phase = PHASES.BATTLE
    room.ticTacToe = createTttState()
    room.ticTacToeRematch = { host: false, guest: false }
    if (room.gameType === GAME_TYPES.TIC_TAC_TOE) {
      io.to(upperCode).emit('ttt:start', room.ticTacToe)
      broadcastRoomList(room.gameType)
      return
    }

    if (room.gameType === GAME_TYPES.HANGMAN_DUEL) {
      room.phase = PHASES.BATTLE
      room.hangman = createHangmanState()
      room.hangmanRematch = { host: false, guest: false }
      emitHangmanState(io, room, 'hangman:start')
      return
    }

    // DURAK: initialize game immediately when second player joins
    room.phase = PHASES.BATTLE
    room.durak = createDurakState()
    room.durakRematch = { host: false, guest: false }
    emitDurakState(io, room, 'durak:start')
    broadcastRoomList(room.gameType)
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

  // ── ttt:move ───────────────────────────────────────────────────────────────
  socket.on('ttt:move', ({ index }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.TIC_TAC_TOE || !room.ticTacToe) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = applyTttMove(room.ticTacToe, player.role, index)
    if (!result.ok) {
      socket.emit('ttt:error', { message: result.error })
      return
    }

    room.ticTacToe = result.state
    room.ticTacToeRematch = { host: false, guest: false }

    if (room.ticTacToe.winner || room.ticTacToe.draw) {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === room.ticTacToe.winner)
      room.winner = winnerPlayer?.id || null
    }

    io.to(room.code).emit('ttt:state', room.ticTacToe)
  })

  // ── ttt:rematch ────────────────────────────────────────────────────────────
  socket.on('ttt:rematch', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.TIC_TAC_TOE || !room.ticTacToe) return
    if (room.phase !== PHASES.GAME_OVER || (!room.ticTacToe.winner && !room.ticTacToe.draw)) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    if (!room.ticTacToeRematch) room.ticTacToeRematch = { host: false, guest: false }
    room.ticTacToeRematch[player.role] = true

    io.to(room.code).emit('ttt:rematch_state', {
      hostReady: room.ticTacToeRematch.host,
      guestReady: room.ticTacToeRematch.guest,
    })

    if (!room.ticTacToeRematch.host || !room.ticTacToeRematch.guest) return

    room.phase = PHASES.BATTLE
    room.winner = null
    room.ticTacToe = createTttState()
    room.ticTacToeRematch = { host: false, guest: false }
    io.to(room.code).emit('ttt:start', room.ticTacToe)
  })

  // ── hangman:set_word ───────────────────────────────────────────────────────
  socket.on('hangman:set_word', ({ word }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.HANGMAN_DUEL || !room.hangman) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = setHangmanWord(room.hangman, player.role, word)
    if (!result.ok) {
      socket.emit('hangman:error', { message: result.error })
      return
    }

    room.hangman = result.state
    room.hangmanRematch = { host: false, guest: false }
    room.phase = PHASES.BATTLE
    room.winner = null
    emitHangmanState(io, room)
  })

  // ── hangman:guess ──────────────────────────────────────────────────────────
  socket.on('hangman:guess', ({ letter }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.HANGMAN_DUEL || !room.hangman) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = guessHangmanLetter(room.hangman, player.role, letter)
    if (!result.ok) {
      socket.emit('hangman:error', { message: result.error })
      return
    }

    room.hangman = result.state
    room.hangmanRematch = { host: false, guest: false }
    if (room.hangman.phase === 'finished') {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === room.hangman.winner)
      room.winner = winnerPlayer?.id || null
    } else {
      room.phase = PHASES.BATTLE
      room.winner = null
    }

    emitHangmanState(io, room)
  })

  // ── hangman:rematch ────────────────────────────────────────────────────────
  socket.on('hangman:rematch', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.HANGMAN_DUEL || !room.hangman) return
    if (room.phase !== PHASES.GAME_OVER || room.hangman.phase !== 'finished') return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    if (!room.hangmanRematch) room.hangmanRematch = { host: false, guest: false }
    room.hangmanRematch[player.role] = true

    io.to(room.code).emit('hangman:rematch_state', {
      hostReady: room.hangmanRematch.host,
      guestReady: room.hangmanRematch.guest,
    })

    if (!room.hangmanRematch.host || !room.hangmanRematch.guest) return

    room.phase = PHASES.BATTLE
    room.winner = null
    room.hangman = createHangmanState()
    room.hangmanRematch = { host: false, guest: false }
    emitHangmanState(io, room, 'hangman:start')
  })

  // ── durak:play ─────────────────────────────────────────────────────────────
  socket.on('durak:play', ({ cardId }) => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.DURAK || !room.durak) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = applyDurakPlay(room.durak, player.role, cardId)
    if (!result.ok) {
      socket.emit('durak:error', { message: result.error })
      return
    }

    room.durak = result.state
    room.durakRematch = { host: false, guest: false }

    if (room.durak.winner || room.durak.draw) {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === room.durak.winner)
      room.winner = winnerPlayer?.id || null
    }

    emitDurakState(io, room)
  })

  // ── durak:done ─────────────────────────────────────────────────────────────
  socket.on('durak:done', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.DURAK || !room.durak) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = applyDurakDone(room.durak, player.role)
    if (!result.ok) {
      socket.emit('durak:error', { message: result.error })
      return
    }

    room.durak = result.state
    room.durakRematch = { host: false, guest: false }
    if (room.durak.winner || room.durak.draw) {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === room.durak.winner)
      room.winner = winnerPlayer?.id || null
    } else {
      room.phase = PHASES.BATTLE
      room.winner = null
    }

    emitDurakState(io, room)
  })

  // ── durak:take ─────────────────────────────────────────────────────────────
  socket.on('durak:take', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.DURAK || !room.durak) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    const result = applyDurakTake(room.durak, player.role)
    if (!result.ok) {
      socket.emit('durak:error', { message: result.error })
      return
    }

    room.durak = result.state
    room.durakRematch = { host: false, guest: false }
    if (room.durak.winner || room.durak.draw) {
      room.phase = PHASES.GAME_OVER
      const winnerPlayer = room.players.find((p) => p.role === room.durak.winner)
      room.winner = winnerPlayer?.id || null
    } else {
      room.phase = PHASES.BATTLE
      room.winner = null
    }

    emitDurakState(io, room)
  })

  // ── durak:rematch ──────────────────────────────────────────────────────────
  socket.on('durak:rematch', () => {
    const room = rm.getRoomByPlayer(socket.id)
    if (!room || room.gameType !== GAME_TYPES.DURAK || !room.durak) return
    if (room.phase !== PHASES.GAME_OVER || (!room.durak.winner && !room.durak.draw)) return

    const player = roomPlayerById(room, socket.id)
    if (!player) return

    if (!room.durakRematch) room.durakRematch = { host: false, guest: false }
    room.durakRematch[player.role] = true

    io.to(room.code).emit('durak:rematch_state', {
      hostReady: room.durakRematch.host,
      guestReady: room.durakRematch.guest,
    })

    if (!room.durakRematch.host || !room.durakRematch.guest) return

    room.phase = PHASES.BATTLE
    room.winner = null
    room.durak = createDurakState()
    room.durakRematch = { host: false, guest: false }
    emitDurakState(io, room, 'durak:start')
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
    const prevRoom = rm.getRoomByPlayer(socket.id)
    const gameType = prevRoom?.gameType
    const roomCode = prevRoom?.code
    const room = rm.removePlayer(socket.id)
    if (room && room.players.length > 0) {
      io.to(room.code).emit('room:opponent_left')
      rm.closeRoom(room.code)
    }
    if (gameType && roomCode) {
      socket.leave(roomCode)
      broadcastRoomList(gameType)
    }
  })
}
