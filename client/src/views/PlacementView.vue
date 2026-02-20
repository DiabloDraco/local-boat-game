<template>
  <div class="placement-wrap">
    <h1 class="game-title">РАССТАНОВКА</h1>
    <p class="subtitle">Расставьте флот на поле</p>

    <div class="placement-layout">
      <!-- Ship tray -->
      <div class="ship-tray card">
        <h3 class="tray-title">Флот</h3>
        <div class="ships-list">
          <div
            v-for="(shipDef, idx) in remainingShips"
            :key="shipDef.id"
            class="ship-item"
            :class="{ selected: activeShip && activeShip.id === shipDef.id }"
            @click="selectShip(shipDef)"
          >
            <div class="ship-cells-preview">
              <div
                v-for="i in shipDef.size"
                :key="i"
                class="ship-cell-block"
              ></div>
            </div>
            <span class="ship-name">{{ SHIP_NAMES[shipDef.name] }}</span>
          </div>
        </div>

        <div class="tray-hint">
          <template v-if="activeShip">
            <span>Нажмите <kbd>R</kbd> для поворота</span>
            <br />
            <span>Ориентация: <strong>{{ activeShip.orientation === 'horizontal' ? '↔' : '↕' }}</strong></span>
          </template>
          <template v-else-if="remainingShips.length > 0">
            Выберите корабль из списка
          </template>
          <template v-else>
            Все корабли расставлены!
          </template>
        </div>

        <div class="tray-actions">
          <button class="btn btn-ghost btn-sm" @click="clearBoard" :disabled="placedShips.length === 0">
            Очистить
          </button>
          <button
            class="btn btn-primary"
            :disabled="remainingShips.length > 0 || confirmed"
            @click="confirm"
          >
            {{ confirmed ? 'Ожидание...' : 'Готово' }}
          </button>
        </div>

        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      </div>

      <!-- Grid -->
      <div class="grid-section">
        <div class="grid-paper">
          <GameGrid
            mode="placement"
            :cells="gameStore.myBoard"
            :active-ship="activeShip"
            @cell-click="onCellClick"
          />
        </div>
      </div>
    </div>

    <!-- Waiting for opponent overlay -->
    <div v-if="confirmed && !battleStarted" class="waiting-overlay">
      <div class="card waiting-card">
        <div class="spinner"></div>
        <p>Ожидание соперника...</p>
      </div>
    </div>

    <!-- Opponent left -->
    <div v-if="opponentLeft" class="modal-overlay">
      <div class="modal">
        <div class="modal-title lose">Соперник отключился</div>
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

const SHIP_NAMES = {
  battleship: 'Линкор (4)',
  cruiser:    'Крейсер (3)',
  destroyer:  'Эсминец (2)',
  submarine:  'Подлодка (1)',
}

const FLEET_DEF = [
  { name: 'battleship', size: 4, count: 1 },
  { name: 'cruiser',    size: 3, count: 2 },
  { name: 'destroyer',  size: 2, count: 3 },
  { name: 'submarine',  size: 1, count: 4 },
]

// Generate ship instances with unique IDs
function generateFleet() {
  const fleet = []
  for (const def of FLEET_DEF) {
    for (let i = 0; i < def.count; i++) {
      fleet.push({ id: `${def.name}_${i}`, name: def.name, size: def.size, orientation: 'horizontal' })
    }
  }
  return fleet
}

const fleet        = ref(generateFleet())
const placedShips  = ref([])  // { id, name, size, row, col, orientation }
const activeShip   = ref(null)
const confirmed    = ref(false)
const battleStarted = ref(false)
const errorMsg     = ref('')
const opponentLeft = ref(false)

const remainingShips = computed(() => {
  const placedIds = new Set(placedShips.value.map(s => s.id))
  return fleet.value.filter(s => !placedIds.has(s.id))
})

function selectShip(ship) {
  if (confirmed.value) return
  activeShip.value = { ...ship }
}

function onCellClick({ row, col, action }) {
  if (confirmed.value) return

  if (action === 'place' && activeShip.value) {
    const newShip = { ...activeShip.value, row, col }
    placedShips.value.push(newShip)
    gameStore.setMyShips([...placedShips.value])
    activeShip.value = null
  }

  if (action === 'pickup') {
    // Find which ship is at this cell
    const cell = gameStore.myBoard[row][col]
    if (!cell.shipId) return
    const idx = placedShips.value.findIndex(s => s.id === cell.shipId)
    if (idx === -1) return
    const ship = placedShips.value[idx]
    placedShips.value.splice(idx, 1)
    gameStore.setMyShips([...placedShips.value])
    activeShip.value = { id: ship.id, name: ship.name, size: ship.size, orientation: ship.orientation }
  }
}

function clearBoard() {
  placedShips.value = []
  activeShip.value  = null
  gameStore.setMyShips([])
}

function confirm() {
  errorMsg.value = ''
  confirmed.value = true
  socket.emit('game:place', {
    ships: placedShips.value.map(s => ({
      id: s.id,
      name: s.name,
      size: s.size,
      row: s.row,
      col: s.col,
      orientation: s.orientation,
    }))
  })
}

function goHome() {
  socket.disconnect()
  router.push('/')
}

// Keyboard: R to rotate
function onKeydown(e) {
  if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
    if (activeShip.value) {
      activeShip.value = {
        ...activeShip.value,
        orientation: activeShip.value.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      }
    }
  }
}

onMounted(() => {
  if (!roomStore.roomCode) {
    router.push('/')
    return
  }

  window.addEventListener('keydown', onKeydown)

  socket.on('game:placement_ok', () => {
    // Waiting for opponent
  })

  socket.on('game:placement_error', ({ message }) => {
    errorMsg.value = message
    confirmed.value = false
  })

  socket.on('game:battle_start', ({ firstTurn }) => {
    battleStarted.value = true
    gameStore.setBattleStart(firstTurn)
    router.push('/battle')
  })

  socket.on('room:opponent_left', () => {
    opponentLeft.value = true
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  socket.off('game:placement_ok')
  socket.off('game:placement_error')
  socket.off('game:battle_start')
  socket.off('room:opponent_left')
})
</script>

<style scoped>
.placement-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 24px 40px;
  min-height: 100vh;
  width: 100%;
}

.placement-layout {
  display: flex;
  gap: 28px;
  align-items: flex-start;
  justify-content: center;
  width: 100%;
  max-width: 1100px;
}

/* Ship Tray */
.ship-tray {
  width: 230px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background-image: none !important;
  padding: 24px 20px;
}

/* Убираем декоративные псевдоэлементы карточки для лотка */
.ship-tray::before,
.ship-tray::after {
  display: none !important;
}

.tray-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--ink-light);
  font-weight: 700;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.ships-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ship-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 12px;
  border: 1.5px solid var(--line);
  border-radius: 3px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background: var(--paper);
}

.ship-item:hover {
  border-color: var(--accent);
  background: rgba(44,95,138,0.06);
}

.ship-item.selected {
  border-color: var(--accent);
  background: rgba(44,95,138,0.1);
  box-shadow: 0 0 0 2px rgba(44,95,138,0.2);
}

.ship-cells-preview {
  display: flex;
  gap: 2px;
}

.ship-cell-block {
  width: 13px;
  height: 13px;
  background: var(--ship-fill);
  border: 1px solid var(--ship);
  border-radius: 1px;
}

.ship-name {
  font-size: 12px;
  color: var(--ink-mid);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.tray-hint {
  font-size: 12px;
  color: var(--ink-light);
  line-height: 1.6;
  min-height: 38px;
  padding: 8px 0;
  border-top: 1px dashed var(--line);
}

kbd {
  background: var(--paper-dark);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 11px;
  color: var(--ink-mid);
  font-family: monospace;
  box-shadow: 0 1px 0 var(--line);
}

.tray-actions {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: center;
  padding-top: 4px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 11px;
}

/* Grid section */
.grid-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.grid-paper {
  background: var(--paper-white);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 20px;
  box-shadow: var(--shadow);
  display: inline-block;
}

/* Waiting overlay */
.waiting-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26,26,46,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  backdrop-filter: blur(3px);
}

.waiting-card {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 15px;
  color: var(--ink-mid);
  background-image: none !important;
}

.waiting-card::before,
.waiting-card::after {
  display: none !important;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
