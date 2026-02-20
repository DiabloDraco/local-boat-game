const { GRID_SIZE, SHIP_FLEET, TOTAL_SHIP_CELLS, CELL } = require('./constants')

// Build empty 10x10 grid
function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ state: CELL.EMPTY }))
  )
}

// Get all cells occupied by a ship
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

// Validate ship placement:
// - in bounds
// - no overlap
// - no adjacency (including diagonals) with existing ships
function validatePlacement(ships) {
  // Check fleet composition
  const expectedFleet = {}
  for (const def of SHIP_FLEET) expectedFleet[def.name] = def.count

  const actualFleet = {}
  for (const ship of ships) {
    actualFleet[ship.name] = (actualFleet[ship.name] || 0) + 1
  }

  for (const def of SHIP_FLEET) {
    if ((actualFleet[def.name] || 0) !== def.count) {
      return { valid: false, error: `Неверное количество кораблей "${def.name}"` }
    }
    const ship = ships.find(s => s.name === def.name)
    if (ship && ship.size !== def.size) {
      return { valid: false, error: `Неверный размер корабля "${def.name}"` }
    }
  }

  const occupied = new Set()

  for (const ship of ships) {
    const cells = shipCells(ship)

    for (const { row, col } of cells) {
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { valid: false, error: 'Корабль выходит за пределы поля' }
      }
      const key = `${row},${col}`
      if (occupied.has(key)) {
        return { valid: false, error: 'Корабли перекрываются' }
      }
    }

    // Check adjacency with previously placed ships
    for (const { row, col } of cells) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue
          const nr = row + dr
          const nc = col + dc
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
            if (occupied.has(`${nr},${nc}`)) {
              return { valid: false, error: 'Корабли должны быть на расстоянии минимум 1 клетки' }
            }
          }
        }
      }
    }

    for (const { row, col } of cells) {
      occupied.add(`${row},${col}`)
    }
  }

  return { valid: true }
}

// Build a board object from validated ships
function buildBoard(ships) {
  const grid = createEmptyGrid()
  const builtShips = ships.map(s => ({ ...s, hits: 0, sunk: false }))

  for (const ship of builtShips) {
    for (const { row, col } of shipCells(ship)) {
      grid[row][col] = { state: CELL.SHIP, shipId: ship.id }
    }
  }

  return { grid, ships: builtShips, hitCount: 0 }
}

// Process a shot at (row, col) on a board
// Returns: { result: 'hit'|'miss'|'sunk', sunkShip?: Ship, gameOver: boolean }
function processShot(board, row, col) {
  const cell = board.grid[row][col]

  if (cell.state === CELL.HIT || cell.state === CELL.MISS || cell.state === CELL.SUNK) {
    return { result: 'already_shot', gameOver: false }
  }

  if (cell.state === CELL.EMPTY) {
    board.grid[row][col] = { state: CELL.MISS }
    return { result: 'miss', gameOver: false }
  }

  // Hit
  cell.state = CELL.HIT
  board.hitCount++

  const ship = board.ships.find(s => s.id === cell.shipId)
  ship.hits++

  if (ship.hits === ship.size) {
    // Sunk — mark all ship cells as sunk
    ship.sunk = true
    for (const { row: sr, col: sc } of shipCells(ship)) {
      board.grid[sr][sc] = { state: CELL.SUNK, shipId: ship.id }
    }
    const gameOver = board.hitCount >= TOTAL_SHIP_CELLS
    return { result: 'sunk', sunkShip: ship, gameOver }
  }

  return { result: 'hit', gameOver: false }
}

module.exports = { validatePlacement, buildBoard, processShot, shipCells }
