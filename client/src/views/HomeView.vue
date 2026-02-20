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

      <button
        class="btn btn-primary full-width"
        :disabled="connecting"
        @click="createRoom"
      >
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
        <button
          class="btn btn-ghost"
          :disabled="connecting"
          @click="joinRoom"
        >
          Войти
        </button>
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
const joinCode     = ref('')
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
  error.value = ''
  connecting.value = true
  try {
    await connect()
    socket.emit('room:create', { playerName: playerName.value.trim() })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

async function joinRoom() {
  if (!requireName()) return
  if (!joinCode.value.trim()) { error.value = 'Введите код комнаты'; return }
  error.value = ''
  connecting.value = true
  try {
    await connect()
    socket.emit('room:join', {
      code: joinCode.value.trim().toUpperCase(),
      playerName: playerName.value.trim(),
    })
  } catch {
    error.value = 'Не удалось подключиться к серверу'
    connecting.value = false
  }
}

onMounted(() => {
  roomStore.reset()
  gameStore.reset()

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
})

onUnmounted(() => {
  socket.off('room:created')
  socket.off('room:joined')
  socket.off('room:error')
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
  max-width: 420px;
}

.full-width {
  width: 100%;
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
