<template>
  <div class="hangman-wrap">
    <h1 class="game-title">ВИСЕЛИЦА ДУЭЛЬ</h1>
    <p class="subtitle">2 раунда, смена ролей</p>

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
        <input v-model="roomName" class="input" placeholder="Например: Виселица duel" maxlength="32" />
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

        <p class="section-label top-space">Счет</p>
        <p class="meta-line">{{ hostName }}: {{ scores.host }}</p>
        <p class="meta-line">{{ guestName }}: {{ scores.guest }}</p>

        <p class="section-label top-space">Раунд</p>
        <p class="meta-line">{{ round }} / 2</p>
        <p class="meta-line">Загадывает: {{ setterName }}</p>
        <p class="meta-line">Угадывает: {{ guesserName }}</p>

        <p class="turn-text top-space">{{ statusText }}</p>
        <p v-if="secretWord && isSetter" class="hint-text">Ваше слово: {{ secretWord }}</p>
        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn btn-ghost full-width top-space" @click="leave">Выйти</button>
      </aside>

      <section class="board-area">
        <div class="card puzzle-card">
          <p class="masked-word">{{ maskedWord || '—' }}</p>
          <p class="meta-line wrongs">Ошибки: {{ wrongCount }} / {{ maxWrong }}</p>
          <p class="meta-line">Мимо: {{ wrongLettersText }}</p>
        </div>

        <div v-if="phase === 'set_word'" class="card action-card">
          <template v-if="isSetter">
            <p class="section-label">Введите слово</p>
            <div class="set-word-row">
              <input
                v-model="wordInput"
                class="input"
                placeholder="Только буквы, 2-24"
                maxlength="24"
                @keydown.enter="submitWord"
              />
              <button class="btn btn-primary" @click="submitWord">Загадать</button>
            </div>
          </template>
          <template v-else>
            <p class="meta-line">Соперник загадывает слово...</p>
          </template>
        </div>

        <div v-else-if="phase === 'guess'" class="card action-card">
          <template v-if="isGuesser">
            <p class="section-label">Угадайте букву</p>
            <div class="guess-row">
              <input
                v-model="letterInput"
                class="input letter-input"
                maxlength="1"
                placeholder="Буква"
                @keydown.enter="submitLetter"
              />
              <button class="btn btn-primary" @click="submitLetter">Ход</button>
            </div>
            <div class="letters-grid">
              <button
                v-for="char in alphabet"
                :key="char"
                class="letter-btn"
                :disabled="usedLettersSet.has(char)"
                @click="pickLetter(char)"
              >
                {{ char }}
              </button>
            </div>
          </template>
          <template v-else>
            <p class="meta-line">Соперник угадывает ваше слово...</p>
          </template>
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

    <div v-if="phase === 'finished'" class="modal-overlay">
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
const connecting = ref(false)
const nameError = ref(false)
const error = ref('')
const nameInputRef = ref(null)

const roomCode = ref('')
const myRole = ref(null)
const hostName = ref('')
const guestName = ref('')

const round = ref(1)
const phase = ref('set_word')
const setterRole = ref('host')
const guesserRole = ref('guest')
const maskedWord = ref('')
const guessedLetters = ref([])
const wrongLetters = ref([])
const wrongCount = ref(0)
const maxWrong = ref(6)
const scores = ref({ host: 0, guest: 0 })
const winner = ref(null)
const draw = ref(false)
const secretWord = ref('')
const rematchReady = ref({ host: false, guest: false })
const opponentLeft = ref(false)

const wordInput = ref('')
const letterInput = ref('')
const alphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('')

const setterName = computed(() => setterRole.value === 'host' ? hostName.value : guestName.value)
const guesserName = computed(() => guesserRole.value === 'host' ? hostName.value : guestName.value)
const isSetter = computed(() => myRole.value === setterRole.value)
const isGuesser = computed(() => myRole.value === guesserRole.value)
const usedLettersSet = computed(() => new Set([...guessedLetters.value, ...wrongLetters.value]))
const wrongLettersText = computed(() => wrongLetters.value.join(', ') || '—')
const myRematchReady = computed(() => myRole.value ? Boolean(rematchReady.value[myRole.value]) : false)
const statusText = computed(() => {
  if (phase.value === 'finished') return 'Матч завершен'
  if (phase.value === 'set_word') return isSetter.value ? 'Ваш ход: загадайте слово' : 'Соперник загадывает слово'
  return isGuesser.value ? 'Ваш ход: угадывайте' : 'Соперник угадывает'
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
  if (draw.value) return `Счет ${scores.value.host}:${scores.value.guest}`
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

function resetGameState() {
  round.value = 1
  phase.value = 'set_word'
  setterRole.value = 'host'
  guesserRole.value = 'guest'
  maskedWord.value = ''
  guessedLetters.value = []
  wrongLetters.value = []
  wrongCount.value = 0
  maxWrong.value = 6
  scores.value = { host: 0, guest: 0 }
  winner.value = null
  draw.value = false
  secretWord.value = ''
  rematchReady.value = { host: false, guest: false }
  wordInput.value = ''
  letterInput.value = ''
}

function applyState(state) {
  round.value = state.round
  phase.value = state.phase
  setterRole.value = state.setterRole
  guesserRole.value = state.guesserRole
  maskedWord.value = state.maskedWord
  guessedLetters.value = state.guessedLetters || []
  wrongLetters.value = state.wrongLetters || []
  wrongCount.value = state.wrongCount || 0
  maxWrong.value = state.maxWrong || 6
  scores.value = state.scores || { host: 0, guest: 0 }
  winner.value = state.winner || null
  draw.value = Boolean(state.draw)
  secretWord.value = state.secretWord || ''
  wordInput.value = ''
  letterInput.value = ''
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
      gameType: 'hangman_duel',
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
      gameType: 'hangman_duel',
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
    socket.emit('room:list', { gameType: 'hangman_duel' })
  } catch {
    error.value = 'Не удалось загрузить комнаты'
  }
}

function submitWord() {
  if (!isSetter.value || phase.value !== 'set_word') return
  socket.emit('hangman:set_word', { word: wordInput.value })
}

function submitLetter() {
  if (!isGuesser.value || phase.value !== 'guess') return
  socket.emit('hangman:guess', { letter: letterInput.value })
}

function pickLetter(char) {
  if (!isGuesser.value || phase.value !== 'guess') return
  if (usedLettersSet.value.has(char)) return
  letterInput.value = char
  submitLetter()
}

function requestRematch() {
  if (phase.value !== 'finished' || myRematchReady.value) return
  socket.emit('hangman:rematch')
}

function leave() {
  socket.disconnect()
  mode.value = 'menu'
  roomCode.value = ''
  myRole.value = null
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
  requestRooms()

  socket.on('room:created', ({ code, role, gameType }) => {
    if (gameType !== 'hangman_duel') return
    roomCode.value = code
    myRole.value = role
    hostName.value = playerName.value.trim()
    guestName.value = ''
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:joined', ({ code, role, opponentName, gameType }) => {
    if (gameType !== 'hangman_duel') return
    roomCode.value = code
    myRole.value = role
    hostName.value = opponentName || ''
    guestName.value = playerName.value.trim()
    mode.value = 'waiting'
    connecting.value = false
    error.value = ''
  })

  socket.on('room:opponent_joined', ({ opponentName, gameType }) => {
    if (mode.value === 'menu' || gameType !== 'hangman_duel') return
    if (myRole.value === 'host') guestName.value = opponentName
    if (myRole.value === 'guest') hostName.value = opponentName
  })

  socket.on('room:error', ({ message }) => {
    error.value = message
    connecting.value = false
  })

  socket.on('room:list', ({ gameType, rooms: list }) => {
    if (gameType !== 'hangman_duel') return
    rooms.value = list
  })

  socket.on('room:list_changed', ({ gameType, rooms: list }) => {
    if (gameType !== 'hangman_duel') return
    rooms.value = list
  })

  socket.on('hangman:start', (state) => {
    applyState(state)
    rematchReady.value = { host: false, guest: false }
    mode.value = 'playing'
    error.value = ''
  })

  socket.on('hangman:state', (state) => {
    applyState(state)
    rematchReady.value = { host: false, guest: false }
    error.value = ''
  })

  socket.on('hangman:rematch_state', ({ hostReady, guestReady }) => {
    rematchReady.value = { host: hostReady, guest: guestReady }
  })

  socket.on('hangman:error', ({ message }) => {
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
  socket.off('hangman:start')
  socket.off('hangman:state')
  socket.off('hangman:rematch_state')
  socket.off('hangman:error')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.hangman-wrap {
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
  max-width: 1080px;
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

.board-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.puzzle-card,
.action-card {
  background: var(--paper-white);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 14px;
  box-shadow: var(--shadow);
}

.masked-word {
  font-size: clamp(24px, 3vw, 36px);
  letter-spacing: 8px;
  font-weight: 900;
  text-align: center;
  margin-bottom: 8px;
}

.wrongs {
  margin-bottom: 4px;
}

.join-row,
.set-word-row,
.guess-row {
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

.letter-input {
  width: 90px;
  text-align: center;
  font-size: 24px;
  text-transform: uppercase;
}

.letters-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(11, minmax(0, 1fr));
  gap: 6px;
}

.letter-btn {
  border: 1px solid var(--line);
  background: var(--paper);
  border-radius: 3px;
  height: 30px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.letter-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
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

.turn-text {
  font-weight: 700;
}

.hint-text {
  color: var(--accent);
  font-size: 12px;
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

  .letters-grid {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
}
</style>
