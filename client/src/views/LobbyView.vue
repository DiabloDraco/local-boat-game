<template>
  <div class="lobby-wrap">
    <h1 class="game-title">ЛОББИ</h1>

    <div class="lobby-layout">
      <!-- Left: Room code -->
      <div class="card code-card">
        <p class="section-label">Код комнаты</p>
        <div class="code-display" @click="copyCode" :title="copied ? 'Скопировано!' : 'Нажмите, чтобы скопировать'">
          <span class="code-text">{{ roomStore.roomCode }}</span>
        </div>
        <button class="copy-btn" @click="copyCode">
          {{ copied ? '✓ Скопировано' : '⧉ Копировать' }}
        </button>
        <p class="share-hint">Поделитесь кодом с другом, чтобы он мог подключиться</p>
      </div>

      <!-- Right: Players + status -->
      <div class="card players-card">
        <p class="section-label">Игроки</p>

        <div class="players-section">
          <div class="player-slot filled">
            <div class="player-icon">⚓</div>
            <div class="player-info">
              <div class="player-name">{{ roomStore.playerName }}</div>
              <div class="player-role">{{ roomStore.playerRole === 'host' ? 'Хозяин' : 'Гость' }}</div>
            </div>
            <div class="player-status ready">●</div>
          </div>

          <div class="vs-divider">VS</div>

          <div class="player-slot" :class="roomStore.opponentConnected ? 'filled' : 'waiting'">
            <div class="player-icon">{{ roomStore.opponentConnected ? '⚓' : '?' }}</div>
            <div class="player-info">
              <div class="player-name">{{ roomStore.opponentConnected ? roomStore.opponentName : 'Ожидание...' }}</div>
              <div class="player-role">{{ roomStore.playerRole === 'host' ? 'Гость' : 'Хозяин' }}</div>
            </div>
            <div class="player-status" :class="roomStore.opponentConnected ? 'ready' : 'waiting'">●</div>
          </div>
        </div>

        <div v-if="!roomStore.opponentConnected" class="waiting-msg">
          <div class="spinner"></div>
          <span>Ожидание второго игрока...</span>
        </div>
        <div v-else class="ready-msg">
          <span>Оба игрока подключены — начинаем!</span>
        </div>

        <button class="btn btn-ghost leave-btn" @click="leave">Выйти</button>
      </div>
    </div>

    <div v-if="opponentLeft" class="modal-overlay">
      <div class="modal">
        <div class="modal-title lose">Соперник отключился</div>
        <p class="modal-desc">Игра прервана.</p>
        <button class="btn btn-primary" @click="goHome">На главную</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import socket from '../socket.js'
import { useRoomStore } from '../stores/roomStore.js'
import { useGameStore } from '../stores/gameStore.js'

const router    = useRouter()
const roomStore = useRoomStore()
const gameStore = useGameStore()

const copied      = ref(false)
const opponentLeft = ref(false)

function copyCode() {
  const text = roomStore.roomCode

  // Clipboard API (requires HTTPS or localhost)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    })
    return
  }

  // Fallback for HTTP LAN access
  const el = document.createElement('input')
  el.value = text
  el.style.position = 'fixed'
  el.style.opacity = '0'
  document.body.appendChild(el)
  el.focus()
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function leave() {
  socket.disconnect()
  router.push('/')
}

function goHome() {
  socket.disconnect()
  router.push('/')
}

onMounted(() => {
  if (!roomStore.roomCode) {
    router.push('/')
    return
  }

  socket.on('room:opponent_joined', ({ opponentName }) => {
    roomStore.setOpponent(opponentName)
  })

  socket.on('game:phase_changed', ({ phase }) => {
    gameStore.setPhase(phase)
    if (phase === 'placement') {
      router.push('/placement')
    }
  })

  socket.on('room:opponent_left', () => {
    opponentLeft.value = true
  })
})

onUnmounted(() => {
  socket.off('room:opponent_joined')
  socket.off('game:phase_changed')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.lobby-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 32px 24px;
  gap: 24px;
}

/* Two-column layout */
.lobby-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  max-width: 860px;
}

/* Left card — room code */
.code-card {
  flex: 0 0 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  background-image: none !important;
}
.code-card::before,
.code-card::after { display: none !important; }

/* Right card — players */
.players-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-image: none !important;
}
.players-card::before,
.players-card::after { display: none !important; }

.section-label {
  font-size: 10px;
  color: var(--ink-mid);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  font-weight: 700;
  align-self: flex-start;
}
.code-card .section-label { align-self: center; }

/* Room code display */
.code-display {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper);
  border: 2px solid var(--accent);
  border-radius: 4px;
  padding: 18px 32px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 0 rgba(44,95,138,0.2);
  width: 100%;
}
.code-display:hover {
  background: var(--paper-white);
  border-color: var(--gold);
  transform: translateY(-1px);
  box-shadow: 0 3px 0 rgba(139,105,20,0.2);
}

.code-text {
  font-size: 2.6rem;
  font-weight: 900;
  letter-spacing: 14px;
  color: var(--gold);
  font-family: 'Courier New', monospace;
}

.copy-btn {
  background: transparent;
  border: 1.5px solid var(--line);
  border-radius: 3px;
  padding: 7px 20px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-mid);
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: all 0.15s;
  width: 100%;
  font-family: inherit;
}
.copy-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(44,95,138,0.06);
}

.share-hint {
  font-size: 11px;
  color: var(--ink-light);
  letter-spacing: 0.3px;
  line-height: 1.5;
}

/* Players */
.players-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-slot {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--paper);
  border: 1.5px solid var(--line);
  border-radius: 3px;
  padding: 16px 20px;
}

.player-slot.filled {
  border-color: var(--accent);
  background: rgba(44,95,138,0.04);
}

.player-slot.waiting {
  opacity: 0.5;
  border-style: dashed;
}

.player-icon {
  font-size: 1.8rem;
  width: 40px;
  text-align: center;
}

.player-info { flex: 1; }
.player-name { font-weight: 700; font-size: 16px; color: var(--ink); }
.player-role { font-size: 11px; color: var(--ink-light); margin-top: 3px; letter-spacing: 0.5px; text-transform: uppercase; }

.player-status { font-size: 20px; }
.player-status.ready   { color: var(--green); }
.player-status.waiting { color: var(--line); }

.vs-divider {
  text-align: center;
  font-weight: 900;
  font-size: 11px;
  color: var(--ink-light);
  letter-spacing: 3px;
  text-transform: uppercase;
  padding: 2px 0;
}

/* Status messages */
.waiting-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink-light);
  font-size: 13px;
  letter-spacing: 0.5px;
  padding: 4px 0;
}

.ready-msg {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--green);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 4px 0;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.leave-btn {
  align-self: flex-start;
}

/* Responsive: stack on mobile */
@media (max-width: 620px) {
  .lobby-layout {
    flex-direction: column;
    align-items: stretch;
  }
  .code-card {
    flex: none;
  }
}
</style>
