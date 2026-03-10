<template>
  <div class="home-wrap">
    <h1 class="game-title">МОРСКОЙ БОЙ</h1>
    <p class="subtitle">Мультиплеер по локальной сети</p>

    <div class="card home-card">
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
        <input
          v-model="roomName"
          class="input"
          placeholder="Например: Играем в корабли"
          maxlength="32"
        />
      </div>

      <div class="privacy-row">
        <button
          class="btn"
          :class="roomVisibility === 'public' ? 'btn-primary' : 'btn-ghost'"
          :disabled="connecting"
          @click="roomVisibility = 'public'"
        >
          Публичная
        </button>
        <button
          class="btn"
          :class="roomVisibility === 'private' ? 'btn-primary' : 'btn-ghost'"
          :disabled="connecting"
          @click="roomVisibility = 'private'"
        >
          Приватная
        </button>
      </div>

      <div v-if="roomVisibility === 'private'" class="form-group">
        <label class="form-label">Пароль комнаты</label>
        <input
          v-model="roomPassword"
          class="input"
          placeholder="Введите пароль"
          maxlength="32"
          @keydown.enter="createRoom"
        />
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
            <div class="room-sub">
              {{ room.hostName }} • {{ room.visibility === 'private' ? 'Приватная' : 'Публичная' }}
            </div>
          </div>
          <button class="btn btn-ghost btn-small" :disabled="connecting" @click="joinRoom(room)">Войти</button>
        </div>
      </div>

      <p class="error-msg">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import socket from '../socket.js'
import { useRoomStore } from '../stores/roomStore.js'
import { useGameStore } from '../stores/gameStore.js'

const router    = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()

const playerName   = ref('')
const roomName     = ref('')
const roomVisibility = ref('public')
const roomPassword = ref('')
const rooms        = ref([])
const error        = ref('')
const connecting   = ref(false)
const nameError    = ref(false)
const nameInputRef = ref(null)

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
    socket.once('connect', () => {
      gameStore.mySocketId = socket.id
      resolve()
    })
    socket.once('connect_error', (err) => {
      reject(err)
    })
  })
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
      gameType: 'battleship',
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
      gameType: 'battleship',
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
    socket.emit('room:list', { gameType: 'battleship' })
  } catch {
    error.value = 'Не удалось загрузить комнаты'
  }
}

onMounted(() => {
  roomStore.reset()
  gameStore.reset()
  requestRooms()

  socket.on('room:created', ({ code, role }) => {
    roomStore.setRoom({ code, role, myName: playerName.value.trim() })
    gameStore.mySocketId = socket.id
    connecting.value = false
    router.push('/lobby')
  })

  socket.on('room:joined', ({ code, role, opponentName }) => {
    roomStore.setRoom({ code, role, myName: playerName.value.trim(), opponentName })
    roomStore.opponentConnected = true
    gameStore.mySocketId = socket.id
    connecting.value = false
    router.push('/lobby')
  })

  socket.on('room:error', ({ message }) => {
    error.value = message
    connecting.value = false
  })

  socket.on('room:list', ({ gameType, rooms: list }) => {
    if (gameType !== 'battleship') return
    rooms.value = list
  })

  socket.on('room:list_changed', ({ gameType, rooms: list }) => {
    if (gameType !== 'battleship') return
    rooms.value = list
  })
})

onUnmounted(() => {
  socket.off('room:created')
  socket.off('room:joined')
  socket.off('room:error')
  socket.off('room:list')
  socket.off('room:list_changed')
})
</script>

<style scoped>
.home-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.home-card {
  width: 100%;
  max-width: 560px;
}

.full-width {
  width: 100%;
}

.privacy-row {
  display: flex;
  gap: 10px;
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
  max-height: 240px;
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
  color: var(--red);
}

.input-error {
  border-color: var(--red) !important;
  animation: shake 0.3s ease;
}

.field-error {
  font-size: 12px;
  color: var(--red);
  margin-top: 2px;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}
</style>
