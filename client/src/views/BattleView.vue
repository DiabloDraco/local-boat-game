<template>
  <div class="battle-wrap">
    <header class="battle-header">
      <span class="header-name">{{ roomStore.playerName }}</span>
      <span class="header-vs">VS</span>
      <span class="header-name">{{ roomStore.opponentName }}</span>
    </header>

    <!-- Turn banner -->
    <div class="turn-banner" :class="gameStore.isMyTurn ? 'my-turn' : 'enemy-turn'">
      <span class="turn-icon">{{ gameStore.isMyTurn ? '🎯' : '⏳' }}</span>
      <div class="turn-text">
        <span class="turn-main">{{ gameStore.isMyTurn ? 'Ваш ход' : 'Ход противника' }}</span>
        <span class="turn-sub">{{ gameStore.isMyTurn ? 'Кликните по полю врага для выстрела' : `${roomStore.opponentName} думает...` }}</span>
      </div>
      <div v-if="gameStore.isMyTurn" class="turn-pulse"></div>
    </div>

    <!-- Flash result -->
    <Transition name="flash">
      <div v-if="flashMsg" class="flash-msg" :class="flashType">
        {{ flashMsg }}
      </div>
    </Transition>

    <!-- Two grids -->
    <div class="boards-wrap">
      <div class="board-section">
        <h3 class="board-label">Ваше поле</h3>
        <div class="grid-paper" :class="{ 'under-attack': !gameStore.isMyTurn && !gameOver }">
          <GameGrid
            mode="defense"
            :cells="gameStore.myBoard"
            :can-shoot="false"
          />
        </div>
      </div>

      <div class="board-section">
        <h3 class="board-label attack-label" :class="{ active: gameStore.isMyTurn }">
          Поле противника
          <span v-if="gameStore.isMyTurn" class="aim-hint">← целься сюда</span>
        </h3>
        <div class="grid-paper" :class="{ 'my-turn-board': gameStore.isMyTurn && !gameOver }">
          <GameGrid
            mode="attack"
            :cells="gameStore.enemyBoard"
            :can-shoot="gameStore.isMyTurn && !gameOver"
            @cell-click="onShoot"
          />
        </div>
      </div>
    </div>

    <!-- Game over modal -->
    <div v-if="gameOver" class="modal-overlay">
      <div class="modal">
        <div class="modal-title" :class="isWinner ? 'win' : 'lose'">
          {{ isWinner ? '🏆 Победа!' : '💀 Поражение' }}
        </div>
        <p class="modal-desc">
          {{ isWinner
            ? `Вы потопили весь флот ${roomStore.opponentName}!`
            : `${gameStore.winner?.name} потопил ваш флот.`
          }}
        </p>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="goHome">На главную</button>
        </div>
      </div>
    </div>

    <!-- Opponent disconnected -->
    <div v-if="opponentLeft && !gameOver" class="modal-overlay">
      <div class="modal">
        <div class="modal-title lose">Соперник отключился</div>
        <p class="modal-desc">Игра прервана.</p>
        <button class="btn btn-primary" @click="goHome">На главную</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GameGrid from '../components/GameGrid.vue'
import socket from '../socket.js'
import { useGameStore } from '../stores/gameStore.js'
import { useRoomStore } from '../stores/roomStore.js'

const router    = useRouter()
const gameStore = useGameStore()
const roomStore = useRoomStore()

const opponentLeft = ref(false)
const flashMsg  = ref('')
const flashType = ref('')
let flashTimer = null

const gameOver = computed(() => gameStore.phase === 'game_over')
const isWinner = computed(() => gameStore.winner && gameStore.winner.id === gameStore.mySocketId)

function showFlash(msg, type) {
  flashMsg.value  = msg
  flashType.value = type
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashMsg.value = ''
  }, 2000)
}

function onShoot({ row, col }) {
  socket.emit('game:shoot', { row, col })
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

  socket.on('game:shot_result', ({ row, col, result, sunkShip }) => {
    gameStore.applyShotResult({ row, col, result, sunkShip })
    if (result === 'sunk') {
      showFlash('Потоплен!', 'flash-sunk')
    } else if (result === 'hit') {
      showFlash('Попадание!', 'flash-hit')
    } else {
      showFlash('Промах', 'flash-miss')
    }
  })

  socket.on('game:incoming_shot', ({ row, col, result, sunkShip }) => {
    gameStore.applyIncomingShot({ row, col, result, sunkShip })
    if (result === 'sunk') {
      showFlash('Потоплен!', 'flash-danger')
    } else if (result === 'hit') {
      showFlash('Попадание по вашему кораблю!', 'flash-danger')
    }
  })

  socket.on('game:turn_changed', ({ currentTurn }) => {
    gameStore.switchTurn(currentTurn)
  })

  socket.on('game:over', ({ winner, winnerName }) => {
    gameStore.setWinner(winner, winnerName)
  })

  socket.on('room:opponent_left', () => {
    opponentLeft.value = true
  })
})

onUnmounted(() => {
  clearTimeout(flashTimer)
  socket.off('game:shot_result')
  socket.off('game:incoming_shot')
  socket.off('game:turn_changed')
  socket.off('game:over')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.battle-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 24px 40px;
  min-height: 100vh;
  gap: 10px;
  width: 100%;
}

.battle-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 28px;
  background: var(--paper-white);
  border-radius: 3px;
  border: 1px solid var(--line);
  width: 100%;
  max-width: 1060px;
  justify-content: center;
  box-shadow: var(--shadow);
}

.header-name {
  font-weight: 700;
  font-size: 15px;
  flex: 1;
  text-align: center;
  color: var(--ink);
  letter-spacing: 0.5px;
}

.header-vs {
  font-size: 11px;
  font-weight: 900;
  color: var(--ink-light);
  letter-spacing: 3px;
  text-transform: uppercase;
  border-left: 1px solid var(--line);
  border-right: 1px solid var(--line);
  padding: 0 16px;
}

/* Boards */
.boards-wrap {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  max-width: 1060px;
}

.board-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* ── Turn Banner ── */
.turn-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 28px;
  border-radius: 4px;
  width: 100%;
  max-width: 1060px;
  position: relative;
  overflow: hidden;
  border: 2px solid;
  transition: all 0.3s;
}

.turn-banner.my-turn {
  background: rgba(45,106,79,0.08);
  border-color: var(--green);
}

.turn-banner.enemy-turn {
  background: rgba(192,57,43,0.06);
  border-color: rgba(192,57,43,0.4);
}

.turn-icon {
  font-size: 1.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.turn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.turn-main {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.my-turn .turn-main  { color: var(--green); }
.enemy-turn .turn-main { color: var(--hit); }

.turn-sub {
  font-size: 12px;
  color: var(--ink-light);
  letter-spacing: 0.3px;
}

/* Пульсирующий кружок при вашем ходе */
.turn-pulse {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(45,106,79,0.6); opacity: 1; }
  70%  { box-shadow: 0 0 0 12px rgba(45,106,79,0); opacity: 0.8; }
  100% { box-shadow: 0 0 0 0 rgba(45,106,79,0); opacity: 1; }
}

/* ── Board labels ── */
.board-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--ink-light);
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
}

.board-label.attack-label.active {
  color: var(--green);
}

.aim-hint {
  font-size: 10px;
  color: var(--green);
  font-style: italic;
  letter-spacing: 0.5px;
  font-weight: 600;
  animation: blink 1.2s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Grid paper states ── */
.grid-paper {
  background: var(--paper-white);
  border: 2px solid var(--line);
  border-radius: 3px;
  padding: 16px;
  box-shadow: var(--shadow);
  transition: border-color 0.3s, box-shadow 0.3s;
}

/* Поле врага — подсвечивается когда ваш ход */
.grid-paper.my-turn-board {
  border-color: var(--green);
  box-shadow: var(--shadow), 0 0 0 3px rgba(45,106,79,0.15);
}

/* Ваше поле — подсвечивается когда ход врага */
.grid-paper.under-attack {
  border-color: rgba(192,57,43,0.35);
  box-shadow: var(--shadow), 0 0 0 3px rgba(192,57,43,0.08);
}

/* Flash message */
.flash-msg {
  padding: 7px 20px;
  border-radius: 3px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.flash-hit    { background: rgba(192,57,43,0.08);  color: var(--hit);  border: 1.5px solid var(--hit); }
.flash-sunk   { background: rgba(139,26,26,0.1);   color: var(--sunk); border: 1.5px solid var(--sunk); }
.flash-miss   { background: rgba(74,122,154,0.1);  color: var(--miss); border: 1.5px solid var(--miss); }
.flash-danger { background: rgba(192,57,43,0.07);  color: var(--hit);  border: 1.5px solid var(--hit); }

/* Flash transition */
.flash-enter-active, .flash-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.flash-enter-from, .flash-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
