import { defineStore } from 'pinia'
import { ref } from 'vue'

const GRID_SIZE = 10

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: 'empty', shipId: null }))
  )
}

export const useGameStore = defineStore('game', () => {
  const phase       = ref('lobby')
  const myBoard     = ref(createEmptyGrid())
  const enemyBoard  = ref(createEmptyGrid())
  const myShips     = ref([])            // Ships placed by this player
  const isMyTurn    = ref(false)
  const winner      = ref(null)          // { id, name }
  const mySocketId  = ref(null)
  const lastResult  = ref(null)          // last shot result for animation

  function setPhase(p) {
    phase.value = p
  }

  function setMyShips(ships) {
    myShips.value = ships
    // Rebuild myBoard from ships
    const grid = createEmptyGrid()
    for (const ship of ships) {
      const cells = shipCells(ship)
      for (const { row, col } of cells) {
        grid[row][col] = { state: 'ship', shipId: ship.id }
      }
    }
    myBoard.value = grid
  }

  function setBattleStart(firstTurnId) {
    isMyTurn.value = firstTurnId === mySocketId.value
  }

  // Called when our shot lands
  function applyShotResult({ row, col, result, sunkShip }) {
    const cell = enemyBoard.value[row][col]
    if (result === 'miss') {
      cell.state = 'miss'
    } else if (result === 'hit') {
      cell.state = 'hit'
    } else if (result === 'sunk') {
      // Mark all cells of the sunk ship
      if (sunkShip) {
        const cells = shipCells(sunkShip)
        for (const { row: r, col: c } of cells) {
          enemyBoard.value[r][c].state = 'sunk'
          enemyBoard.value[r][c].shipId = sunkShip.id
        }
      } else {
        cell.state = 'sunk'
      }
    }
    lastResult.value = { row, col, result }
  }

  // Called when enemy shoots at us
  function applyIncomingShot({ row, col, result, sunkShip }) {
    const cell = myBoard.value[row][col]
    if (result === 'miss') {
      cell.state = 'miss'
    } else if (result === 'hit') {
      cell.state = 'hit'
    } else if (result === 'sunk') {
      if (sunkShip) {
        const cells = shipCells(sunkShip)
        for (const { row: r, col: c } of cells) {
          myBoard.value[r][c].state = 'sunk'
        }
      } else {
        cell.state = 'sunk'
      }
    }
  }

  function switchTurn(currentTurnId) {
    isMyTurn.value = currentTurnId === mySocketId.value
  }

  function setWinner(winnerId, winnerName) {
    winner.value = { id: winnerId, name: winnerName }
    phase.value = 'game_over'
  }

  function reset() {
    phase.value      = 'lobby'
    myBoard.value    = createEmptyGrid()
    enemyBoard.value = createEmptyGrid()
    myShips.value    = []
    isMyTurn.value   = false
    winner.value     = null
    lastResult.value = null
  }

  return {
    phase, myBoard, enemyBoard, myShips, isMyTurn, winner, mySocketId, lastResult,
    setPhase, setMyShips, setBattleStart, applyShotResult, applyIncomingShot, switchTurn, setWinner, reset,
  }
})

function shipCells(ship) {
  const cells = []
  for (let i = 0; i < ship.size; i++) {
    if (ship.orientation === 'horizontal') {
      cells.push({ row: ship.row, col: ship.col + i })
    } else {
      cells.push({ row: ship.row + i, col: ship.col })
    }
  }
  return cells
}
