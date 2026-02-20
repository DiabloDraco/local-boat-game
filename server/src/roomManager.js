const { customAlphabet } = require('nanoid')
const { PHASES } = require('./constants')

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)

// rooms: Map<code, RoomObject>
const rooms = new Map()

// playerToRoom: Map<socketId, code>
const playerToRoom = new Map()

function createRoom(socketId, playerName) {
  const code = _uniqueCode()
  rooms.set(code, {
    code,
    phase: PHASES.LOBBY,
    players: [
      { id: socketId, name: playerName, role: 'host' }
    ],
    boards: {},
    currentTurn: null,
    winner: null,
  })
  playerToRoom.set(socketId, code)
  return code
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code)
  if (!room) return { error: 'Комната не найдена' }
  if (room.players.length >= 2) return { error: 'Комната уже заполнена' }
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

function _uniqueCode() {
  let code
  do { code = nanoid() } while (rooms.has(code))
  return code
}

module.exports = { createRoom, joinRoom, getRoom, getRoomByPlayer, getOpponent, removePlayer }
