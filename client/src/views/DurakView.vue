<template>
  <div class="durak-wrap">
    <h1 class="game-title">ДУРАК</h1>
    <p class="subtitle">Онлайн-игра 1 на 1 (36 карт)</p>

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
        <input v-model="roomName" class="input" placeholder="Например: Партия в дурака" maxlength="32" />
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

    <div v-else class="game-layout">
      <aside class="card side-card">
        <p class="section-label">Комната</p>
        <p class="room-code">{{ roomCode }}</p>

        <p class="section-label top-space">Стол</p>
        <p class="meta-line">Козырь: {{ suitSymbol(trumpSuit) }}</p>
        <p class="meta-line">Колода: {{ deckCount }}</p>
        <p class="meta-line">У соперника карт: {{ opponentCount }}</p>

        <p class="section-label top-space">Роли</p>
        <p class="meta-line" :class="{ active: isAttacker }">Атакует: {{ attackerName }}</p>
        <p class="meta-line" :class="{ active: isDefender }">Защищается: {{ defenderName }}</p>

        <p class="turn-text top-space">{{ statusText }}</p>
        <p v-if="error" class="error-msg">{{ error }}</p>

        <div class="actions">
          <button class="btn btn-primary" :disabled="!canDone" @click="doneRound">Бито</button>
          <button class="btn btn-danger" :disabled="!canTake" @click="takeCards">Взять</button>
        </div>

        <button class="btn btn-ghost full-width top-space" @click="leave">Выйти</button>
      </aside>

      <section class="board-area">
        <div class="table-card">
          <div class="table-head">
            <div class="trump-card">
              <span class="trump-rank">{{ trumpCard?.rank || '?' }}</span>
              <span class="trump-suit" :class="{ red: isRedSuit(trumpSuit) }">{{ suitSymbol(trumpSuit) }}</span>
            </div>
            <div class="deck-stack">
              <span>{{ deckCount }}</span>
            </div>
          </div>

          <div class="table-grid">
            <div v-for="(pair, idx) in tablePairs" :key="idx" class="pair">
              <div class="mini-label">Атака</div>
              <div class="card-mini">{{ cardText(pair.attack) }}</div>
              <div class="mini-label">Отбой</div>
              <div class="card-mini defend">{{ pair.defend ? cardText(pair.defend) : '...' }}</div>
            </div>
            <div v-if="tablePairs.length === 0" class="empty-table">
              Стол пуст
            </div>
          </div>
        </div>

        <div class="hand-card">
          <p class="section-label">Ваша рука</p>
          <div class="hand-list">
            <button
              v-for="card in hand"
              :key="card.id"
              class="hand-item"
              :class="{ selected: selectedCardId === card.id }"
              :disabled="!canPlayCard(card)"
              @click="playCard(card)"
            >
              <span>{{ card.rank }}</span>
              <span :class="{ red: isRedSuit(card.suit) }">{{ suitSymbol(card.suit) }}</span>
            </button>
          </div>
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
        <div class="modal-title" :class="resultClass">{{ resultTitle }}</div>
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

const hand = ref([])
const opponentCount = ref(0)
const deckCount = ref(0)
const trumpSuit = ref('spades')
const trumpCard = ref(null)
const attackerRole = ref('host')
const defenderRole = ref('guest')
const phase = ref('attack')
const tablePairs = ref([])
const winner = ref(null)
const draw = ref(false)
const rematchReady = ref({ host: false, guest: false })
const opponentLeft = ref(false)
const selectedCardId = ref(null)

const isAttacker = computed(() => myRole.value === attackerRole.value)
const isDefender = computed(() => myRole.value === defenderRole.value)
const isMyTurn = computed(() => {
  if (winner.value || draw.value) return false
  if (phase.value === 'attack') return isAttacker.value
  if (phase.value === 'defend') return isDefender.value
  return false
})
const canDone = computed(() => {
  if (!isAttacker.value || phase.value !== 'attack') return false
  if (tablePairs.value.length === 0) return false
  return tablePairs.value.every((p) => Boolean(p.defend))
})
const canTake = computed(() => isDefender.value && phase.value === 'defend' && tablePairs.value.length > 0)
const myRematchReady = computed(() => myRole.value ? Boolean(rematchReady.value[myRole.value]) : false)
const attackerName = computed(() => attackerRole.value === 'host' ? hostName.value : guestName.value)
const defenderName = computed(() => defenderRole.value === 'host' ? hostName.value : guestName.value)
const statusText = computed(() => {
  if (winner.value || draw.value) return 'Партия завершена'
  if (isMyTurn.value) return phase.value === 'attack' ? 'Ваш ход: атака' : 'Ваш ход: защита'
  return 'Ход соперника'
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
  if (draw.value) return 'У обоих закончились карты.'
  return winner.value === 'host' ? `${hostName.value} вышел из игры первым` : `${guestName.value} вышел из игры первым`
})

function suitSymbol(suit) {
  if (suit === 'hearts') return '♥'
  if (suit === 'diamonds') return '♦'
  if (suit === 'clubs') return '♣'
  return '♠'
}

function isRedSuit(suit) {
  return suit === 'hearts' || suit === 'diamonds'
}

function cardText(card) {
  if (!card) return ''
  return `${card.rank}${suitSymbol(card.suit)}`
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
  hand.value = []
  opponentCount.value = 0
  deckCount.value = 0
  trumpSuit.value = 'spades'
  trumpCard.value = null
  attackerRole.value = 'host'
  defenderRole.value = 'guest'
  phase.value = 'attack'
  tablePairs.value = []
  winner.value = null
  draw.value = false
  rematchReady.value = { host: false, guest: false }
  selectedCardId.value = null
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
      gameType: 'durak',
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
      gameType: 'durak',
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
    socket.emit('room:list', { gameType: 'durak' })
  } catch {
    error.value = 'Не удалось загрузить комнаты'
  }
}

function applyState(state) {
  hand.value = state.hand || []
  opponentCount.value = state.opponentCount || 0
  deckCount.value = state.deckCount || 0
  trumpSuit.value = state.trumpSuit || 'spades'
  trumpCard.value = state.trumpCard || null
  attackerRole.value = state.attackerRole || 'host'
  defenderRole.value = state.defenderRole || 'guest'
  phase.value = state.phase || 'attack'
  tablePairs.value = state.table?.pairs || []
  winner.value = state.winner || null
  draw.value = Boolean(state.draw)
  selectedCardId.value = null
}

function canPlayCard() {
  return isMyTurn.value
}

function playCard(card) {
  if (!canPlayCard(card)) return
  selectedCardId.value = card.id
  socket.emit('durak:play', { cardId: card.id })
}

function doneRound() {
  if (!canDone.value) return
  socket.emit('durak:done')
}

function takeCards() {
  if (!canTake.value) return
  socket.emit('durak:take')
}

function requestRematch() {
  if ((!winner.value && !draw.value) || myRematchReady.value) return
  socket.emit('durak:rematch')
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
  resetGameState()
}

function goGames() {
  socket.disconnect()
  router.push('/')
}

onMounted(() => {
  requestRooms()

  socket.on('room:created', ({ code, role, gameType }) => {
    if (gameType !== 'durak') return
    roomCode.value = code
    myRole.value = role
    hostName.value = playerName.value.trim()
    guestName.value = ''
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:joined', ({ code, role, opponentName, gameType }) => {
    if (gameType !== 'durak') return
    roomCode.value = code
    myRole.value = role
    hostName.value = opponentName || ''
    guestName.value = playerName.value.trim()
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:opponent_joined', ({ opponentName, gameType }) => {
    if (mode.value === 'menu' || gameType !== 'durak') return
    if (myRole.value === 'host') guestName.value = opponentName
    if (myRole.value === 'guest') hostName.value = opponentName
  })

  socket.on('room:error', ({ message }) => {
    error.value = message
    connecting.value = false
  })

  socket.on('room:list', ({ gameType, rooms: list }) => {
    if (gameType !== 'durak') return
    rooms.value = list
  })

  socket.on('room:list_changed', ({ gameType, rooms: list }) => {
    if (gameType !== 'durak') return
    rooms.value = list
  })

  socket.on('durak:start', (state) => {
    applyState(state)
    rematchReady.value = { host: false, guest: false }
    mode.value = 'playing'
    error.value = ''
  })

  socket.on('durak:state', (state) => {
    applyState(state)
    rematchReady.value = { host: false, guest: false }
    error.value = ''
  })

  socket.on('durak:rematch_state', ({ hostReady, guestReady }) => {
    rematchReady.value = { host: hostReady, guest: guestReady }
  })

  socket.on('durak:error', ({ message }) => {
    error.value = message
    selectedCardId.value = null
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
  socket.off('durak:start')
  socket.off('durak:state')
  socket.off('durak:rematch_state')
  socket.off('durak:error')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.durak-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 24px;
}

.menu-card,
.waiting-card {
  width: 100%;
  max-width: 420px;
}

.waiting-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-layout {
  width: 100%;
  max-width: 1180px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: center;
}

.side-card {
  width: 300px;
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

.meta-line {
  color: var(--ink-mid);
  font-weight: 600;
}

.meta-line.active {
  color: var(--green);
}

.turn-text {
  font-weight: 700;
}

.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.actions .btn {
  flex: 1;
}

.board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-card,
.hand-card {
  background: var(--paper-white);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 14px;
  box-shadow: var(--shadow);
}

.table-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.trump-card,
.deck-stack {
  width: 58px;
  height: 78px;
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.deck-stack {
  background: linear-gradient(160deg, #e8decb 0%, #d7cab1 100%);
}

.trump-rank {
  font-size: 20px;
}

.trump-suit {
  font-size: 22px;
}

.red {
  color: #c0392b;
}

.table-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.pair {
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 8px;
  background: #fffef9;
}

.mini-label {
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink-light);
}

.card-mini {
  margin-top: 4px;
  margin-bottom: 8px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.card-mini.defend {
  margin-bottom: 0;
}

.empty-table {
  min-height: 76px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  color: var(--ink-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hand-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.hand-item {
  width: 72px;
  height: 96px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 24px;
  font-weight: 800;
  cursor: pointer;
}

.hand-item.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(44, 95, 138, 0.15);
}

.hand-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 980px) {
  .game-layout {
    flex-direction: column;
    align-items: center;
  }

  .side-card {
    width: min(92vw, 620px);
  }

  .board-area {
    width: min(92vw, 720px);
  }
}
</style>
