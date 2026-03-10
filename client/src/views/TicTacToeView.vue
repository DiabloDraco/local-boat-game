<template>
  <div class="ttt-wrap">
    <h1 class="game-title">КРЕСТИКИ-НОЛИКИ</h1>
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

      <div class="form-group">
        <label class="form-label">Название комнаты</label>
        <input v-model="roomName" class="input" placeholder="Например: Крестики duel" maxlength="32" />
      </div>

      <div class="privacy-row">
        <button class="btn" :class="roomVisibility === 'public' ? 'btn-primary' : 'btn-ghost'" :disabled="connecting" @click="roomVisibility = 'public'">Публичная</button>
        <button class="btn" :class="roomVisibility === 'private' ? 'btn-primary' : 'btn-ghost'" :disabled="connecting" @click="roomVisibility = 'private'">Приватная</button>
      </div>

      <div v-if="roomVisibility === 'private'" class="form-group">
        <label class="form-label">Пароль комнаты</label>
        <input v-model="roomPassword" class="input" placeholder="Введите пароль" maxlength="32" @keydown.enter="createRoom" />
      </div>

      <button class="btn btn-primary full-width" :disabled="connecting" @click="createRoom">
        {{ connecting ? 'Подключение...' : 'Создать комнату' }}
      </button>

      <div class="divider">или</div>

      <div class="rooms-head">
        <span class="form-label">Список комнат</span>
        <button class="btn btn-ghost btn-small" :disabled="connecting" @click="requestRooms">Обновить</button>
      </div>
      <div class="rooms-list">
        <div v-if="rooms.length === 0" class="rooms-empty">Нет доступных комнат</div>
        <div v-for="room in rooms" :key="room.code" class="room-row">
          <div class="room-meta">
            <div class="room-title">{{ room.roomName }}</div>
            <div class="room-sub">{{ room.hostName }} • {{ room.visibility === 'private' ? 'Приватная' : 'Публичная' }}</div>
          </div>
          <button class="btn btn-ghost btn-small" :disabled="connecting" @click="joinRoom(room)">Войти</button>
        </div>
      </div>

      <button class="btn btn-ghost full-width back-btn" @click="goGames">К списку игр</button>
      <p class="error-msg">{{ error }}</p>
    </div>

    <div v-else-if="mode === 'waiting'" class="card waiting-card">
      <p class="section-label">Код комнаты</p>
      <div class="room-code">{{ roomCode }}</div>
      <p class="waiting-text">Ожидание второго игрока...</p>
      <button class="btn btn-ghost full-width" @click="leave">Выйти</button>
    </div>

    <div v-else class="ttt-layout">
      <aside class="card side-card">
        <p class="section-label">Комната</p>
        <p class="room-code">{{ roomCode }}</p>

        <p class="section-label top-space">Игроки</p>
        <p class="player-line">X: {{ hostName }}</p>
        <p class="player-line">O: {{ guestName }}</p>

        <p class="turn-text top-space">{{ statusText }}</p>
        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn btn-ghost full-width top-space" @click="leave">Выйти</button>
      </aside>

      <section class="board-wrap">
        <div class="ttt-board">
          <button
            v-for="(cell, idx) in board"
            :key="idx"
            class="ttt-cell"
            :disabled="!canPlay(idx)"
            @click="makeMove(idx)"
          >
            <span class="ttt-mark">{{ markForCell(cell) }}</span>
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

    <div v-if="winner || draw" class="modal-overlay">
      <div class="modal">
        <div class="modal-title" :class="resultClass">
          {{ resultTitle }}
        </div>
        <p class="modal-desc">{{ resultText }}</p>
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

const mode = ref('menu')
const playerName = ref('')
const roomName = ref('')
const roomVisibility = ref('public')
const roomPassword = ref('')
const rooms = ref([])
const error = ref('')
const connecting = ref(false)
const nameError = ref(false)
const nameInputRef = ref(null)

const roomCode = ref('')
const myRole = ref(null)
const hostName = ref('')
const guestName = ref('')

const board = ref(Array.from({ length: 9 }, () => null))
const currentTurn = ref('host')
const winner = ref(null)
const draw = ref(false)
const rematchReady = ref({ host: false, guest: false })
const opponentLeft = ref(false)

const myRematchReady = computed(() => myRole.value ? Boolean(rematchReady.value[myRole.value]) : false)
const isMyTurn = computed(() => mode.value === 'playing' && !winner.value && !draw.value && currentTurn.value === myRole.value)
const myMark = computed(() => myRole.value === 'host' ? 'X' : 'O')
const statusText = computed(() => {
  if (winner.value || draw.value) return 'Партия завершена'
  return isMyTurn.value ? `Ваш ход (${myMark.value})` : 'Ход соперника'
})
const resultClass = computed(() => {
  if (draw.value) return ''
  return winner.value === myRole.value ? 'win' : 'lose'
})
const resultTitle = computed(() => {
  if (draw.value) return 'Ничья'
  return winner.value === myRole.value ? 'Победа!' : 'Поражение'
})
const resultText = computed(() => {
  if (draw.value) return 'Поле заполнено, победителя нет.'
  return winner.value === 'host' ? `${hostName.value} победил` : `${guestName.value} победил`
})

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

function resetState() {
  board.value = Array.from({ length: 9 }, () => null)
  currentTurn.value = 'host'
  winner.value = null
  draw.value = false
  rematchReady.value = { host: false, guest: false }
}

async function createRoom() {
  if (!requireName()) return
  if (roomVisibility.value === 'private' && !roomPassword.value.trim()) {
    error.value = 'Введите пароль для приватной комнаты'
    return
  }
  error.value = ''
  connecting.value = true
  try {
    await connect()
    socket.emit('room:create', {
      playerName: playerName.value.trim(),
      gameType: 'tic_tac_toe',
      roomName: roomName.value.trim(),
      visibility: roomVisibility.value,
      password: roomVisibility.value === 'private' ? roomPassword.value : '',
    })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

async function joinRoom(room) {
  if (!requireName()) return
  error.value = ''
  connecting.value = true
  try {
    const password = room.requiresPassword ? (window.prompt('Введите пароль комнаты') || '') : ''
    await connect()
    socket.emit('room:join', {
      code: room.code,
      playerName: playerName.value.trim(),
      gameType: 'tic_tac_toe',
      password,
    })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

async function requestRooms() {
  try {
    await connect()
    socket.emit('room:list', { gameType: 'tic_tac_toe' })
  } catch {
    error.value = 'Не удалось загрузить комнаты'
  }
}

function markForCell(cell) {
  if (cell === 'host') return 'X'
  if (cell === 'guest') return 'O'
  return ''
}

function canPlay(index) {
  return isMyTurn.value && !board.value[index]
}

function makeMove(index) {
  if (!canPlay(index)) return
  socket.emit('ttt:move', { index })
}

function requestRematch() {
  if ((!winner.value && !draw.value) || myRematchReady.value) return
  socket.emit('ttt:rematch')
}

function leave() {
  socket.disconnect()
  mode.value = 'menu'
  roomCode.value = ''
  myRole.value = null
  hostName.value = ''
  guestName.value = ''
  error.value = ''
  connecting.value = false
  opponentLeft.value = false
  resetState()
}

function goGames() {
  socket.disconnect()
  router.push('/')
}

onMounted(() => {
  requestRooms()

  socket.on('room:created', ({ code, role, gameType }) => {
    if (gameType !== 'tic_tac_toe') return
    roomCode.value = code
    myRole.value = role
    hostName.value = playerName.value.trim()
    guestName.value = ''
    mode.value = 'waiting'
    connecting.value = false
  })

  socket.on('room:joined', ({ code, role, opponentName, gameType }) => {
    if (gameType !== 'tic_tac_toe') return
    roomCode.value = code
    myRole.value = role
    hostName.value = opponentName || ''
    guestName.value = playerName.value.trim()
    mode.value = 'waiting'
    connecting.value = false
  })

  socket.on('room:opponent_joined', ({ opponentName, gameType }) => {
    if (mode.value === 'menu' || gameType !== 'tic_tac_toe') return
    if (myRole.value === 'host') guestName.value = opponentName
    if (myRole.value === 'guest') hostName.value = opponentName
  })

  socket.on('room:error', ({ message }) => {
    error.value = message
    connecting.value = false
  })

  socket.on('room:list', ({ gameType, rooms: list }) => {
    if (gameType !== 'tic_tac_toe') return
    rooms.value = list
  })

  socket.on('room:list_changed', ({ gameType, rooms: list }) => {
    if (gameType !== 'tic_tac_toe') return
    rooms.value = list
  })

  socket.on('ttt:start', (state) => {
    board.value = state.board
    currentTurn.value = state.currentTurn
    winner.value = state.winner
    draw.value = state.draw
    rematchReady.value = { host: false, guest: false }
    mode.value = 'playing'
    error.value = ''
  })

  socket.on('ttt:state', (state) => {
    board.value = state.board
    currentTurn.value = state.currentTurn
    winner.value = state.winner
    draw.value = state.draw
    rematchReady.value = { host: false, guest: false }
  })

  socket.on('ttt:rematch_state', ({ hostReady, guestReady }) => {
    rematchReady.value = { host: hostReady, guest: guestReady }
  })

  socket.on('ttt:error', ({ message }) => {
    error.value = message
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
  socket.off('room:list')
  socket.off('room:list_changed')
  socket.off('ttt:start')
  socket.off('ttt:state')
  socket.off('ttt:rematch_state')
  socket.off('ttt:error')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.ttt-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 24px;
}

.menu-card {
  width: 100%;
  max-width: 420px;
}

.waiting-card {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ttt-layout {
  width: 100%;
  max-width: 900px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: center;
}

.side-card {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.join-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.privacy-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.privacy-row .btn {
  flex: 1;
}

.rooms-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.btn-small {
  padding: 8px 12px;
  font-size: 11px;
}

.rooms-list {
  border: 1px solid var(--line);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.55);
  max-height: 220px;
  overflow: auto;
}

.rooms-empty {
  padding: 12px;
  color: var(--ink-light);
  text-align: center;
  font-size: 13px;
}

.room-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--line);
}

.room-row:first-child {
  border-top: none;
}

.room-meta {
  min-width: 0;
}

.room-title {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-sub {
  font-size: 12px;
  color: var(--ink-light);
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

.back-btn {
  margin-top: 8px;
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

.top-space {
  margin-top: 10px;
}

.player-line {
  color: var(--ink-mid);
  font-weight: 600;
}

.turn-text {
  font-weight: 700;
}

.board-wrap {
  display: flex;
  justify-content: center;
}

.ttt-board {
  width: min(78vw, 420px);
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
}

.ttt-cell {
  border: 2px solid var(--line);
  background: var(--paper-white);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.ttt-cell:not(:disabled):hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.ttt-cell:disabled {
  cursor: default;
}

.ttt-mark {
  font-size: clamp(46px, 9vw, 80px);
  font-weight: 900;
  line-height: 1;
  color: var(--accent);
}

@media (max-width: 860px) {
  .ttt-layout {
    flex-direction: column;
    align-items: center;
  }

  .side-card {
    width: min(90vw, 520px);
  }
}
</style>
