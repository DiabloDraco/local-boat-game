const CHECKERS_SIZE = 8

function createInitialBoard() {
  const board = Array.from({ length: CHECKERS_SIZE }, () => Array.from({ length: CHECKERS_SIZE }, () => null))

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < CHECKERS_SIZE; col++) {
      if ((row + col) % 2 === 1) board[row][col] = { player: 'host', king: false }
    }
  }

  for (let row = 5; row < CHECKERS_SIZE; row++) {
    for (let col = 0; col < CHECKERS_SIZE; col++) {
      if ((row + col) % 2 === 1) board[row][col] = { player: 'guest', king: false }
    }
  }

  return board
}

function inBounds(row, col) {
  return row >= 0 && row < CHECKERS_SIZE && col >= 0 && col < CHECKERS_SIZE
}

function isDarkCell(row, col) {
  return (row + col) % 2 === 1
}

function movementDirs(piece) {
  if (piece.king) return [1, -1]
  return piece.player === 'host' ? [1] : [-1]
}

function pieceMoves(board, row, col) {
  const piece = board[row][col]
  if (!piece) return []

  if (piece.king) {
    const moves = []
    for (const dr of [1, -1]) {
      for (const dc of [1, -1]) {
        let nr = row + dr
        let nc = col + dc
        while (inBounds(nr, nc) && isDarkCell(nr, nc) && !board[nr][nc]) {
          moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc, capture: false })
          nr += dr
          nc += dc
        }
      }
    }
    return moves
  }

  const moves = []
  for (const dr of movementDirs(piece)) {
    for (const dc of [-1, 1]) {
      const nr = row + dr
      const nc = col + dc
      if (inBounds(nr, nc) && isDarkCell(nr, nc) && !board[nr][nc]) {
        moves.push({ fromRow: row, fromCol: col, toRow: nr, toCol: nc, capture: false })
      }
    }
  }

  return moves
}

function pieceCaptures(board, row, col) {
  const piece = board[row][col]
  if (!piece) return []

  if (piece.king) {
    const moves = []
    for (const dr of [1, -1]) {
      for (const dc of [1, -1]) {
        let nr = row + dr
        let nc = col + dc
        let enemy = null

        while (inBounds(nr, nc)) {
          const cell = board[nr][nc]
          if (!cell) {
            if (enemy) {
              moves.push({
                fromRow: row,
                fromCol: col,
                toRow: nr,
                toCol: nc,
                capture: true,
                capturedRow: enemy.row,
                capturedCol: enemy.col,
              })
            }
            nr += dr
            nc += dc
            continue
          }

          if (cell.player === piece.player) break
          if (enemy) break

          enemy = { row: nr, col: nc }
          nr += dr
          nc += dc
        }
      }
    }
    return moves
  }

  const moves = []
  for (const dr of movementDirs(piece)) {
    for (const dc of [-1, 1]) {
      const midRow = row + dr
      const midCol = col + dc
      const toRow = row + dr * 2
      const toCol = col + dc * 2

      if (!inBounds(midRow, midCol) || !inBounds(toRow, toCol)) continue
      if (!isDarkCell(toRow, toCol)) continue

      const middle = board[midRow][midCol]
      if (!middle || middle.player === piece.player) continue
      if (board[toRow][toCol]) continue

      moves.push({
        fromRow: row,
        fromCol: col,
        toRow,
        toCol,
        capture: true,
        capturedRow: midRow,
        capturedCol: midCol,
      })
    }
  }

  return moves
}

function allMovesForPlayer(board, player) {
  const captures = []
  const normalMoves = []

  for (let row = 0; row < CHECKERS_SIZE; row++) {
    for (let col = 0; col < CHECKERS_SIZE; col++) {
      const piece = board[row][col]
      if (!piece || piece.player !== player) continue
      captures.push(...pieceCaptures(board, row, col))
      normalMoves.push(...pieceMoves(board, row, col))
    }
  }

  return captures.length > 0 ? captures : normalMoves
}

function cloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function maybePromote(piece, row) {
  if (piece.king) return false
  if (piece.player === 'host' && row === CHECKERS_SIZE - 1) {
    piece.king = true
    return true
  }
  if (piece.player === 'guest' && row === 0) {
    piece.king = true
    return true
  }
  return false
}

function countPieces(board, player) {
  let count = 0
  for (let row = 0; row < CHECKERS_SIZE; row++) {
    for (let col = 0; col < CHECKERS_SIZE; col++) {
      if (board[row][col]?.player === player) count++
    }
  }
  return count
}

function resolveWinner(board, currentTurn) {
  const hostCount = countPieces(board, 'host')
  const guestCount = countPieces(board, 'guest')
  if (hostCount === 0) return 'guest'
  if (guestCount === 0) return 'host'

  const legal = allMovesForPlayer(board, currentTurn)
  if (legal.length === 0) {
    return currentTurn === 'host' ? 'guest' : 'host'
  }

  return null
}

function applyMove(state, playerRole, moveInput) {
  if (!state || !state.board) return { ok: false, error: 'Игра не инициализирована' }
  if (state.winner) return { ok: false, error: 'Игра уже завершена' }
  if (state.currentTurn !== playerRole) return { ok: false, error: 'Сейчас ход соперника' }

  const { fromRow, fromCol, toRow, toCol } = moveInput || {}
  const nums = [fromRow, fromCol, toRow, toCol]
  if (nums.some(v => !Number.isInteger(v))) return { ok: false, error: 'Некорректные координаты' }
  if (!inBounds(fromRow, fromCol) || !inBounds(toRow, toCol)) return { ok: false, error: 'Ход вне доски' }

  const piece = state.board[fromRow][fromCol]
  if (!piece) return { ok: false, error: 'В выбранной клетке нет шашки' }
  if (piece.player !== playerRole) return { ok: false, error: 'Это не ваша шашка' }
  if (state.forcedFrom && (state.forcedFrom.row !== fromRow || state.forcedFrom.col !== fromCol)) {
    return { ok: false, error: 'Нужно продолжить рубку этой же шашкой' }
  }

  const captures = pieceCaptures(state.board, fromRow, fromCol)
  const normals = pieceMoves(state.board, fromRow, fromCol)
  const playerHasCapture = allMovesForPlayer(state.board, playerRole).some(m => m.capture)
  const legalFromPiece = playerHasCapture ? captures : [...captures, ...normals]

  const chosen = legalFromPiece.find(m => m.toRow === toRow && m.toCol === toCol)
  if (!chosen) {
    return { ok: false, error: playerHasCapture ? 'Есть обязательная рубка' : 'Недопустимый ход' }
  }

  const board = cloneBoard(state.board)
  const movingPiece = { ...board[fromRow][fromCol] }
  board[fromRow][fromCol] = null
  board[toRow][toCol] = movingPiece

  let captured = null
  if (chosen.capture) {
    captured = { row: chosen.capturedRow, col: chosen.capturedCol }
    board[chosen.capturedRow][chosen.capturedCol] = null
  }

  const promoted = maybePromote(movingPiece, toRow)

  let nextTurn = playerRole === 'host' ? 'guest' : 'host'
  let forcedFrom = null

  if (chosen.capture) {
    const nextCaptures = pieceCaptures(board, toRow, toCol)
    if (nextCaptures.length > 0) {
      nextTurn = playerRole
      forcedFrom = { row: toRow, col: toCol }
    }
  }

  const winner = resolveWinner(board, nextTurn)

  return {
    ok: true,
    state: {
      ...state,
      board,
      currentTurn: nextTurn,
      forcedFrom,
      winner,
      lastMove: {
        fromRow,
        fromCol,
        toRow,
        toCol,
        player: playerRole,
        capture: chosen.capture,
      },
    },
    meta: {
      captured,
      promoted,
      mustContinue: Boolean(forcedFrom),
      nextTurn,
      winner,
    },
  }
}

function createInitialState() {
  return {
    board: createInitialBoard(),
    currentTurn: 'host',
    forcedFrom: null,
    winner: null,
    lastMove: null,
  }
}

module.exports = {
  CHECKERS_SIZE,
  createInitialState,
  applyMove,
}
