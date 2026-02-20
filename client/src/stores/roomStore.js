import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRoomStore = defineStore('room', () => {
  const roomCode          = ref(null)
  const playerRole        = ref(null)   // 'host' | 'guest'
  const playerName        = ref('')
  const opponentName      = ref('')
  const opponentConnected = ref(false)
  const mySocketId        = ref(null)

  function setRoom({ code, role, myName, opponentName: oppName }) {
    roomCode.value     = code
    playerRole.value   = role
    playerName.value   = myName
    if (oppName) opponentName.value = oppName
  }

  function setOpponent(name) {
    opponentName.value      = name
    opponentConnected.value = true
  }

  function reset() {
    roomCode.value          = null
    playerRole.value        = null
    playerName.value        = ''
    opponentName.value      = ''
    opponentConnected.value = false
    mySocketId.value        = null
  }

  return { roomCode, playerRole, playerName, opponentName, opponentConnected, mySocketId, setRoom, setOpponent, reset }
})
