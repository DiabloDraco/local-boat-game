<template>
  <div class="checkers-wrap">
    <h1 class="game-title">ШАШКИ</h1>
    <p class="subtitle">Онлайн-игра 1 на 1</p>

    <div v-if="mode === 'menu'" class="card menu-card">
      <div class="form-group">
        <label class="form-label">Ваше имя <span class="required">*</span></label>
        <input
          ref="nameInputRef"
          v-model="playerName"
          class="input"
          :class="{ 'input-error': nameError }"
          placeholder="Введите имя"
          maxlength="24"
          @keydown.enter="createRoom"
          @input="nameError = false"
        />
        <span v-if="nameError" class="field-error">Введите ваше имя</span>
      </div>

      <button class="btn btn-primary full-width" :disabled="connecting" @click="createRoom">
        {{ connecting ? 'Подключение...' : 'Создать комнату' }}
      </button>

      <div class="divider">или</div>

      <div class="join-row">
        <input
          v-model="joinCode"
          class="input code-input"
          placeholder="КОД"
          maxlength="4"
          style="text-transform:uppercase"
          @keydown.enter="joinRoom"
        />
        <button class="btn btn-ghost" :disabled="connecting" @click="joinRoom">Войти</button>
      </div>

      <button class="btn btn-ghost full-width back-btn" @click="goGames">К списку игр</button>
      <p class="error-msg">{{ error }}</p>
    </div>

    <div v-else-if="mode === 'waiting'" class="waiting-layout">
      <div class="card waiting-card">
        <p class="section-label">Код комнаты</p>
        <div class="room-code">{{ roomCode }}</div>
        <p class="waiting-text">Ожидание второго игрока...</p>
        <button class="btn btn-ghost full-width" @click="leave">Выйти</button>
      </div>

      <div class="card waiting-card">
        <p class="section-label">Игроки</p>
        <p>{{ playerName }} (вы)</p>
        <p>{{ opponentName || 'Ожидание...' }}</p>
      </div>
    </div>

    <div v-else class="game-layout">
      <aside class="card side-card">
        <p class="section-label">Комната</p>
        <p class="room-code">{{ roomCode }}</p>

        <p class="section-label top-space">Игроки</p>
        <p class="player-line" :class="{ active: currentTurn === 'host' }">
          ● {{ hostName }}
        </p>
        <p class="player-line" :class="{ active: currentTurn === 'guest' }">
          ● {{ guestName }}
        </p>

        <p class="turn-text top-space">
          {{ winner ? winnerText : isMyTurn ? 'Ваш ход' : 'Ход соперника' }}
        </p>

        <p v-if="forcedFrom && isMyTurn" class="hint-text">
          Продолжите рубку этой же шашкой
        </p>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn btn-ghost full-width top-space" @click="leave">Выйти</button>
      </aside>

      <section class="board-wrap">
        <div class="board">
          <button
            v-for="(_, idx) in 64"
            :key="idx"
            class="cell"
            :class="cellClassByView(viewCoords(idx).row, viewCoords(idx).col)"
            @click="onCellClickView(viewCoords(idx).row, viewCoords(idx).col)"
          >
            <span
              v-if="pieceAtView(viewCoords(idx).row, viewCoords(idx).col)"
              class="piece"
              :class="pieceAtView(viewCoords(idx).row, viewCoords(idx).col).player"
            >
              <span v-if="pieceAtView(viewCoords(idx).row, viewCoords(idx).col).king" class="king">♛</span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <div v-if="opponentLeft" class="modal-overlay">
      <div class="modal">
        <div class="modal-title lose">Соперник отключился</div>
        <p class="modal-desc">Игра прервана.</p>
        <button class="btn btn-primary" @click="goGames">К списку игр</button>
      </div>
    </div>

    <div v-if="winner" class="modal-overlay">
      <div class="modal">
        <div class="modal-title" :class="winner === myRole ? 'win' : 'lose'">
          {{ winner === myRole ? 'Победа!' : 'Поражение' }}
        </div>
        <p class="modal-desc">{{ winnerText }}</p>
        <div class="modal-actions">
          <button class="btn btn-primary" :disabled="myRematchReady" @click="requestRematch">
            {{ myRematchReady ? 'Ожидание соперника...' : 'Реванш' }}
          </button>
          <button class="btn btn-ghost" @click="goGames">К списку игр</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import socket from '../socket.js'

const router = useRouter()

const mode = ref('menu') // menu | waiting | playing
const playerName = ref('')
const joinCode = ref('')
const error = ref('')
const connecting = ref(false)
const nameError = ref(false)
const nameInputRef = ref(null)

const roomCode = ref('')
const myRole = ref(null) // host | guest
const opponentName = ref('')
const hostName = ref('')
const guestName = ref('')

const board = ref([])
const currentTurn = ref('host')
const forcedFrom = ref(null)
const winner = ref(null)
const selected = ref(null)
const legalTargets = ref([])
const rematchReady = ref({ host: false, guest: false })

const opponentLeft = ref(false)

const isMyTurn = computed(() => mode.value === 'playing' && !winner.value && currentTurn.value === myRole.value)
const shouldFlipBoard = computed(() => myRole.value === 'host')
const myRematchReady = computed(() => {
  if (!myRole.value) return false
  return Boolean(rematchReady.value[myRole.value])
})
const winnerText = computed(() => {
  if (!winner.value) return ''
  return winner.value === 'host' ? `${hostName.value} победил` : `${guestName.value} победил`
})
const availableStarts = computed(() => {
  if (!isMyTurn.value) return []
  if (forcedFrom.value) return [forcedFrom.value]

  const cells = []
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = pieceAt(row, col)
      if (piece?.player !== myRole.value) continue
      if (movesForPiece(row, col).length > 0) cells.push({ row, col })
    }
  }
  return cells
})

function viewCoords(idx) {
  return { row: Math.floor(idx / 8), col: idx % 8 }
}

function viewToBoard(viewRow, viewCol) {
  if (!shouldFlipBoard.value) return { row: viewRow, col: viewCol }
  return { row: 7 - viewRow, col: 7 - viewCol }
}

function pieceAtView(viewRow, viewCol) {
  const { row, col } = viewToBoard(viewRow, viewCol)
  return pieceAt(row, col)
}

function pieceAt(row, col) {
  return board.value?.[row]?.[col] || null
}

function requireName() {
  if (!playerName.value.trim()) {
    nameError.value = true
    nextTick(() => nameInputRef.value?.focus())
    return false
  }
  return true
}

function connect() {
  if (socket.connected) return Promise.resolve()
  return new Promise((resolve, reject) => {
    socket.connect()
    socket.once('connect', () => resolve())
    socket.once('connect_error', (err) => reject(err))
  })
}

function resetGameState() {
  board.value = []
  currentTurn.value = 'host'
  forcedFrom.value = null
  winner.value = null
  rematchReady.value = { host: false, guest: false }
  selected.value = null
  legalTargets.value = []
}

async function createRoom() {
  if (!requireName()) return
  error.value = ''
  connecting.value = true
  try {
    await connect()
    socket.emit('room:create', {
      playerName: playerName.value.trim(),
      gameType: 'checkers',
    })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

async function joinRoom() {
  if (!requireName()) return
  if (!joinCode.value.trim()) {
    error.value = 'Введите код комнаты'
    return
  }

  error.value = ''
  connecting.value = true
  try {
    await connect()
    socket.emit('room:join', {
      code: joinCode.value.trim().toUpperCase(),
      playerName: playerName.value.trim(),
      gameType: 'checkers',
    })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

function movementDirs(piece) {
  if (piece.king) return [1, -1]
  return piece.player === 'host' ? [1] : [-1]
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function capturesForPiece(row, col) {
  const piece = pieceAt(row, col)
  if (!piece) return []

  const captures = []
  for (const dr of movementDirs(piece)) {
    for (const dc of [-1, 1]) {
      const midRow = row + dr
      const midCol = col + dc
      const toRow = row + dr * 2
      const toCol = col + dc * 2

      if (!inBounds(midRow, midCol) || !inBounds(toRow, toCol)) continue
      const middle = pieceAt(midRow, midCol)
      if (!middle || middle.player === piece.player) continue
      if (pieceAt(toRow, toCol)) continue
      captures.push({ toRow, toCol })
    }
  }

  return captures
}

function movesForPiece(row, col) {
  const piece = pieceAt(row, col)
  if (!piece) return []

  const captures = capturesForPiece(row, col)
  if (captures.length > 0) return captures

  let mustCapture = false
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = pieceAt(r, c)
      if (cell?.player === piece.player && capturesForPiece(r, c).length > 0) {
        mustCapture = true
      }
    }
  }
  if (mustCapture) return []

  const moves = []
  for (const dr of movementDirs(piece)) {
    for (const dc of [-1, 1]) {
      const toRow = row + dr
      const toCol = col + dc
      if (!inBounds(toRow, toCol)) continue
      if (!pieceAt(toRow, toCol)) moves.push({ toRow, toCol })
    }
  }
  return moves
}

function setSelection(row, col) {
  selected.value = { row, col }
  legalTargets.value = movesForPiece(row, col)
}

function clearSelection() {
  selected.value = null
  legalTargets.value = []
}

function onCellClick(row, col) {
  if (!isMyTurn.value) return

  const clicked = pieceAt(row, col)
  const isOwnPiece = clicked && clicked.player === myRole.value

  if (isOwnPiece) {
    if (forcedFrom.value && (forcedFrom.value.row !== row || forcedFrom.value.col !== col)) return
    setSelection(row, col)
    return
  }

  if (!selected.value) return

  const isLegal = legalTargets.value.some((m) => m.toRow === row && m.toCol === col)
  if (!isLegal) return

  socket.emit('checkers:move', {
    fromRow: selected.value.row,
    fromCol: selected.value.col,
    toRow: row,
    toCol: col,
  })
}

function onCellClickView(viewRow, viewCol) {
  const { row, col } = viewToBoard(viewRow, viewCol)
  onCellClick(row, col)
}

function requestRematch() {
  if (!winner.value || myRematchReady.value) return
  socket.emit('checkers:rematch')
}

function cellClass(row, col) {
  const isDark = (row + col) % 2 === 1
  const isSelected = selected.value && selected.value.row === row && selected.value.col === col
  const isTarget = legalTargets.value.some((m) => m.toRow === row && m.toCol === col)
  const isForced = forcedFrom.value && forcedFrom.value.row === row && forcedFrom.value.col === col
  const isSelectable = availableStarts.value.some((m) => m.row === row && m.col === col)

  return {
    dark: isDark,
    light: !isDark,
    selected: Boolean(isSelected),
    target: Boolean(isTarget),
    forced: Boolean(isForced),
    selectable: Boolean(isSelectable),
  }
}

function cellClassByView(viewRow, viewCol) {
  const { row, col } = viewToBoard(viewRow, viewCol)
  return cellClass(row, col)
}

function leave() {
  socket.disconnect()
  mode.value = 'menu'
  roomCode.value = ''
  myRole.value = null
  opponentName.value = ''
  hostName.value = ''
  guestName.value = ''
  connecting.value = false
  error.value = ''
  opponentLeft.value = false
  resetGameState()
}

function goGames() {
  socket.disconnect()
  router.push('/')
}

onMounted(() => {
  socket.on('room:created', ({ code, role, gameType }) => {
    if (gameType && gameType !== 'checkers') return
    roomCode.value = code
    myRole.value = role
    hostName.value = playerName.value.trim()
    guestName.value = ''
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:joined', ({ code, role, opponentName: oppName, gameType }) => {
    if (gameType && gameType !== 'checkers') return
    roomCode.value = code
    myRole.value = role
    opponentName.value = oppName || ''
    hostName.value = oppName || ''
    guestName.value = playerName.value.trim()
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:opponent_joined', ({ opponentName: oppName, gameType }) => {
    if (mode.value === 'menu') return
    if (gameType && gameType !== 'checkers') return
    opponentName.value = oppName
    if (myRole.value === 'host') guestName.value = oppName
    if (myRole.value === 'guest') hostName.value = oppName
  })

  socket.on('room:error', ({ message }) => {
    error.value = message
    connecting.value = false
  })

  socket.on('checkers:start', ({ board: startBoard, currentTurn: turn, forcedFrom: forced, winner: gameWinner }) => {
    board.value = startBoard
    currentTurn.value = turn
    forcedFrom.value = forced
    winner.value = gameWinner
    rematchReady.value = { host: false, guest: false }
    mode.value = 'playing'
    clearSelection()
    error.value = ''
  })

  socket.on('checkers:state', (state) => {
    board.value = state.board
    currentTurn.value = state.currentTurn
    forcedFrom.value = state.forcedFrom
    winner.value = state.winner
    rematchReady.value = { host: false, guest: false }
    clearSelection()
  })

  socket.on('checkers:error', ({ message }) => {
    error.value = message
  })

  socket.on('checkers:rematch_state', ({ hostReady, guestReady }) => {
    rematchReady.value = { host: hostReady, guest: guestReady }
    error.value = ''
  })

  socket.on('room:opponent_left', () => {
    if (mode.value !== 'menu') opponentLeft.value = true
  })
})

onUnmounted(() => {
  if (socket.connected) socket.disconnect()
  socket.off('room:created')
  socket.off('room:joined')
  socket.off('room:opponent_joined')
  socket.off('room:error')
  socket.off('checkers:start')
  socket.off('checkers:state')
  socket.off('checkers:error')
  socket.off('checkers:rematch_state')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.checkers-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  width: 100%;
}

.menu-card {
  width: 100%;
  max-width: 420px;
}

.join-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.code-input {
  flex: 1;
  letter-spacing: 4px;
  font-size: 18px;
  text-align: center;
}

.back-btn {
  margin-top: 8px;
}

.required {
  color: var(--hit);
}

.input-error {
  border-color: var(--hit) !important;
}

.field-error {
  font-size: 12px;
  color: var(--hit);
  margin-top: 2px;
}

.waiting-layout,
.game-layout {
  width: 100%;
  max-width: 980px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: center;
}

.waiting-card {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-size: 10px;
  color: var(--ink-mid);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 700;
}

.room-code {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 8px;
  color: var(--gold);
  font-family: 'Courier New', monospace;
}

.waiting-text {
  color: var(--ink-mid);
}

.side-card {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background-image: none !important;
}

.side-card::before,
.side-card::after {
  display: none !important;
}

.top-space {
  margin-top: 10px;
}

.player-line {
  color: var(--ink-mid);
  font-weight: 600;
}

.player-line.active {
  color: var(--green);
}

.turn-text {
  font-weight: 700;
}

.hint-text {
  color: var(--gold);
  font-size: 13px;
}

.board-wrap {
  flex: 1;
  display: flex;
  justify-content: center;
}

.board {
  width: min(80vw, 620px);
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  border: 2px solid var(--ink);
  box-shadow: var(--shadow-lg);
}

.cell {
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: filter 0.15s ease;
}

.cell.light {
  background: #e5d6b9;
}

.cell.dark {
  background: #8b5a2b;
}

.cell.selected {
  box-shadow: inset 0 0 0 4px #2d6a4f;
}

.cell.target {
  box-shadow: inset 0 0 0 4px rgba(44, 95, 138, 0.8);
}

.cell.selectable {
  box-shadow: inset 0 0 0 3px rgba(45, 106, 79, 0.65);
}

.cell.forced {
  box-shadow: inset 0 0 0 4px rgba(192, 57, 43, 0.8);
}

.cell:hover {
  filter: brightness(1.06);
}

.piece {
  width: 72%;
  height: 72%;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
}

.piece.host {
  background: radial-gradient(circle at 35% 35%, #f2f2f2, #d9d9d9 60%, #bbbbbb);
}

.piece.guest {
  background: radial-gradient(circle at 35% 35%, #5b5b5b, #252525 65%, #111111);
}

.king {
  color: #d4af37;
  font-weight: 900;
  font-size: clamp(16px, 2vw, 24px);
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.5);
}

.full-width {
  width: 100%;
}

@media (max-width: 900px) {
  .game-layout {
    flex-direction: column;
    align-items: center;
  }

  .side-card {
    width: min(90vw, 520px);
  }
}
</style>
