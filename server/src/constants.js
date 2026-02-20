const GRID_SIZE = 10;

const SHIP_FLEET = [
  { name: 'battleship', size: 4, count: 1 },
  { name: 'cruiser',    size: 3, count: 2 },
  { name: 'destroyer',  size: 2, count: 3 },
  { name: 'submarine',  size: 1, count: 4 },
];

// Total cells occupied by ships: 4*1 + 3*2 + 2*3 + 1*4 = 20
const TOTAL_SHIP_CELLS = 20;

const PHASES = {
  LOBBY:     'lobby',
  PLACEMENT: 'placement',
  BATTLE:    'battle',
  GAME_OVER: 'game_over',
};

const CELL = {
  EMPTY: 'empty',
  SHIP:  'ship',
  HIT:   'hit',
  MISS:  'miss',
  SUNK:  'sunk',
};

module.exports = { GRID_SIZE, SHIP_FLEET, TOTAL_SHIP_CELLS, PHASES, CELL };
