const { customAlphabet } = require('nanoid')
const { PHASES, GAME_TYPES } = require('./constants')

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)

// rooms: Map<code, RoomObject>
const rooms = new Map()

// playerToRoom: Map<socketId, code>
const playerToRoom = new Map()

function createRoom(socketId, playerName, gameType = GAME_TYPES.BATTLESHIP, options = {}) {
  const code = _uniqueCode()
  const roomName = (options.roomName || `${playerName} room`).toString().trim().slice(0, 32) || `${playerName} room`
  const visibility = options.visibility === 'private' ? 'private' : 'public'
  const password = visibility === 'private' ? (options.password || '').toString().slice(0, 64) : ''
  rooms.set(code, {
    code,
    roomName,
    visibility,
    password,
    gameType,
    phase: PHASES.LOBBY,
    players: [
      { id: socketId, name: playerName, role: 'host' }
    ],
    boards: {},
    checkers: null,
    checkersRematch: { host: false, guest: false },
    ticTacToe: null,
    ticTacToeRematch: { host: false, guest: false },
    durak: null,
    durakRematch: { host: false, guest: false },
    hangman: null,
    hangmanRematch: { host: false, guest: false },
    currentTurn: null,
    winner: null,
  })
  playerToRoom.set(socketId, code)
  return code
}

function joinRoom(code, socketId, playerName, gameType = GAME_TYPES.BATTLESHIP, password = '') {
  const room = rooms.get(code)
  if (!room) return { error: 'Комната не найдена' }
  if (room.phase !== PHASES.LOBBY) return { error: 'Матч в этой комнате уже начался' }
  if (room.players.length >= 2) return { error: 'Комната уже заполнена' }
  if (room.gameType !== gameType) return { error: 'Эта комната создана для другой игры' }
  if (room.visibility === 'private' && room.password !== (password || '').toString()) {
    return { error: 'Неверный пароль комнаты' }
  }
  room.players.push({ id: socketId, name: playerName, role: 'guest' })
  playerToRoom.set(socketId, code)
  return { room }
}

function getRoom(code) {
  return rooms.get(code)
}

function getRoomByPlayer(socketId) {
  const code = playerToRoom.get(socketId)
  return code ? rooms.get(code) : null
}

function getOpponent(room, socketId) {
  return room.players.find(p => p.id !== socketId)
}

function removePlayer(socketId) {
  const code = playerToRoom.get(socketId)
  if (!code) return null
  playerToRoom.delete(socketId)
  const room = rooms.get(code)
  if (!room) return null
  room.players = room.players.filter(p => p.id !== socketId)
  if (room.players.length === 0) {
    rooms.delete(code)
    return null
  }
  return room
}

function closeRoom(code) {
  const room = rooms.get(code)
  if (!room) return
  for (const p of room.players) {
    playerToRoom.delete(p.id)
  }
  rooms.delete(code)
}

function listRooms(gameType = GAME_TYPES.BATTLESHIP) {
  const out = []
  for (const room of rooms.values()) {
    if (room.gameType !== gameType) continue
    if (room.phase !== PHASES.LOBBY) continue
    if (room.players.length >= 2) continue
    const host = room.players.find((p) => p.role === 'host') || room.players[0]
    out.push({
      code: room.code,
      roomName: room.roomName,
      hostName: host ? host.name : 'Игрок',
      playersCount: room.players.length,
      visibility: room.visibility,
      requiresPassword: room.visibility === 'private',
    })
  }
  return out
}

function _uniqueCode() {
  let code
  do { code = nanoid() } while (rooms.has(code))
  return code
}

module.exports = { createRoom, joinRoom, getRoom, getRoomByPlayer, getOpponent, removePlayer, closeRoom, listRooms }
