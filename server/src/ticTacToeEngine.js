const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function createInitialState() {
  return {
    board: Array.from({ length: 9 }, () => null),
    currentTurn: 'host',
    winner: null,
    draw: false,
  }
}

function detectWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]
    }
  }
  return null
}

function applyMove(state, playerRole, index) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.winner || state.draw) return { ok: false, error: 'Партия завершена' }
  if (state.currentTurn !== playerRole) return { ok: false, error: 'Сейчас ход соперника' }
  if (!Number.isInteger(index) || index < 0 || index > 8) return { ok: false, error: 'Некорректная клетка' }
  if (state.board[index]) return { ok: false, error: 'Клетка уже занята' }

  const board = [...state.board]
  board[index] = playerRole

  const winner = detectWinner(board)
  const draw = !winner && board.every(Boolean)
  const nextTurn = winner || draw ? state.currentTurn : playerRole === 'host' ? 'guest' : 'host'

  return {
    ok: true,
    state: {
      board,
      currentTurn: nextTurn,
      winner,
      draw,
    },
  }
}

module.exports = {
  createInitialState,
  applyMove,
}
