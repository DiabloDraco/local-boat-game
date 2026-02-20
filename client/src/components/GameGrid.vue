<template>
  <div class="grid-container">
    <!-- Column labels A-J -->
    <div class="grid-labels-row">
      <div class="corner-cell"></div>
      <div v-for="c in GRID_SIZE" :key="c" class="col-label">{{ colLabel(c - 1) }}</div>
    </div>

    <div class="grid-body">
      <!-- Row labels 1-10 -->
      <div class="row-labels">
        <div v-for="r in GRID_SIZE" :key="r" class="row-label">{{ r }}</div>
      </div>

      <!-- Grid cells -->
      <div class="grid-cells">
        <div
          v-for="r in GRID_SIZE"
          :key="r"
          class="grid-row"
        >
          <div
            v-for="c in GRID_SIZE"
            :key="c"
            class="grid-cell"
            :class="cellClass(r - 1, c - 1)"
            @click="onCellClick(r - 1, c - 1)"
            @mouseenter="onCellHover(r - 1, c - 1)"
            @mouseleave="onCellLeave"
          >
            <div v-if="showMarker(r - 1, c - 1)" class="cell-marker"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const GRID_SIZE = 10

const props = defineProps({
  // 'placement' | 'defense' | 'attack'
  mode: { type: String, default: 'defense' },
  // 10x10 array of { state, shipId }
  cells: { type: Array, required: true },
  // In placement mode: the ship currently being placed
  activeShip: { type: Object, default: null },
  // Whether it's the player's turn (attack mode)
  canShoot: { type: Boolean, default: false },
})

const emit = defineEmits(['cell-click', 'cell-hover'])

const hoverRow = ref(null)
const hoverCol = ref(null)

function colLabel(i) {
  return 'АБВГДЕЖЗИК'[i]
}

function cellClass(row, col) {
  const cell = props.cells[row][col]
  const classes = []

  if (props.mode === 'placement') {
    const preview = getPreviewState(row, col)
    if (preview) {
      classes.push(preview)
    } else {
      classes.push(cell.state)
    }
  } else if (props.mode === 'defense') {
    classes.push(cell.state)
  } else if (props.mode === 'attack') {
    if (cell.state === 'empty') {
      classes.push('empty')
      if (props.canShoot && hoverRow.value === row && hoverCol.value === col) {
        classes.push('attack-hover')
      }
    } else {
      classes.push(cell.state)
    }
    if (props.canShoot && cell.state === 'empty') classes.push('clickable')
  }

  return classes
}

function getPreviewState(row, col) {
  if (!props.activeShip || hoverRow.value === null) return null

  const { size, orientation } = props.activeShip
  const anchorRow = hoverRow.value
  const anchorCol = hoverCol.value

  const cells = []
  for (let i = 0; i < size; i++) {
    if (orientation === 'horizontal') {
      cells.push({ row: anchorRow, col: anchorCol + i })
    } else {
      cells.push({ row: anchorRow + i, col: anchorCol })
    }
  }

  const isInPreview = cells.some(c => c.row === row && c.col === col)
  if (!isInPreview) return null

  // Check validity
  const valid = isValidPlacement(cells)
  return valid ? 'preview-valid' : 'preview-invalid'
}

function isValidPlacement(previewCells) {
  // Check bounds
  for (const { row, col } of previewCells) {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false
  }

  // Check no overlap or adjacency with existing ships
  for (const { row, col } of previewCells) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr
        const nc = col + dc
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          const cellState = props.cells[nr][nc].state
          if (cellState === 'ship') {
            // Is this cell part of the preview itself?
            const inPreview = previewCells.some(c => c.row === nr && c.col === nc)
            if (!inPreview) return false
          }
        }
      }
    }
  }

  return true
}

function canPlaceHere() {
  if (!props.activeShip || hoverRow.value === null) return false
  const { size, orientation } = props.activeShip
  const cells = []
  for (let i = 0; i < size; i++) {
    if (orientation === 'horizontal') {
      cells.push({ row: hoverRow.value, col: hoverCol.value + i })
    } else {
      cells.push({ row: hoverRow.value + i, col: hoverCol.value })
    }
  }
  return isValidPlacement(cells)
}

function showMarker(row, col) {
  const state = props.cells[row][col].state
  return state === 'hit' || state === 'miss' || state === 'sunk'
}

function onCellClick(row, col) {
  if (props.mode === 'placement') {
    if (!props.activeShip) {
      // Click on placed ship to pick it up
      if (props.cells[row][col].state === 'ship') {
        emit('cell-click', { row, col, action: 'pickup' })
      }
      return
    }
    if (canPlaceHere()) {
      emit('cell-click', { row, col, action: 'place' })
    }
  } else if (props.mode === 'attack') {
    if (props.canShoot && props.cells[row][col].state === 'empty') {
      emit('cell-click', { row, col, action: 'shoot' })
    }
  }
}

function onCellHover(row, col) {
  hoverRow.value = row
  hoverCol.value = col
  emit('cell-hover', { row, col })
}

function onCellLeave() {
  hoverRow.value = null
  hoverCol.value = null
}
</script>

<style scoped>
.grid-container {
  display: inline-block;
  user-select: none;
}

.grid-labels-row {
  display: flex;
  align-items: center;
  margin-left: 26px;
}

.corner-cell {
  width: var(--cell-size);
  height: 22px;
}

.col-label {
  width: var(--cell-size);
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--ink-light);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.grid-body {
  display: flex;
}

.row-labels {
  display: flex;
  flex-direction: column;
  width: 26px;
}

.row-label {
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--ink-light);
  font-weight: 700;
}

.grid-cells {
  display: flex;
  flex-direction: column;
  border: 1.5px solid var(--grid-line);
}

.grid-row {
  display: flex;
}

/* Override global .grid-cell hover for attack mode */
.grid-cell.attack-hover {
  background: rgba(44, 95, 138, 0.15);
  cursor: crosshair;
}

.grid-cell.clickable {
  cursor: crosshair;
}

.grid-cell.preview-valid {
  background: rgba(45, 106, 79, 0.2);
  cursor: pointer;
}

.grid-cell.preview-invalid {
  background: rgba(192, 57, 43, 0.15);
  cursor: not-allowed;
}
</style>
