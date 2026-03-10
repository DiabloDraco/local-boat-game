const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const SUITS = ['clubs', 'diamonds', 'hearts', 'spades']

function rankValue(rank) {
  return RANKS.indexOf(rank)
}

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

function buildDeck() {
  const deck = []
  let i = 0
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}-${i++}`, suit, rank })
    }
  }
  return shuffle(deck)
}

function takeFromDeck(state, role) {
  while (state.hands[role].length < 6 && state.deck.length > 0) {
    state.hands[role].push(state.deck.pop())
  }
}

function removeCardFromHand(hand, cardId) {
  const idx = hand.findIndex((c) => c.id === cardId)
  if (idx === -1) return null
  const [card] = hand.splice(idx, 1)
  return card
}

function canBeat(defCard, attCard, trumpSuit) {
  if (defCard.suit === attCard.suit) {
    return rankValue(defCard.rank) > rankValue(attCard.rank)
  }
  return defCard.suit === trumpSuit && attCard.suit !== trumpSuit
}

function tableRanks(state) {
  const ranks = new Set()
  for (const c of state.table.attacks) ranks.add(c.rank)
  for (const c of state.table.defends) {
    if (c) ranks.add(c.rank)
  }
  return ranks
}

function cloneState(state) {
  return {
    deck: state.deck.map((c) => ({ ...c })),
    trumpSuit: state.trumpSuit,
    trumpCard: state.trumpCard ? { ...state.trumpCard } : null,
    hands: {
      host: state.hands.host.map((c) => ({ ...c })),
      guest: state.hands.guest.map((c) => ({ ...c })),
    },
    attackerRole: state.attackerRole,
    defenderRole: state.defenderRole,
    phase: state.phase,
    table: {
      attacks: state.table.attacks.map((c) => ({ ...c })),
      defends: state.table.defends.map((c) => (c ? { ...c } : null)),
    },
    winner: state.winner,
    draw: state.draw,
  }
}

function evaluateRoundEnd(state) {
  if (state.table.attacks.length > 0) return
  if (state.deck.length > 0) return
  const hostEmpty = state.hands.host.length === 0
  const guestEmpty = state.hands.guest.length === 0
  if (hostEmpty && guestEmpty) {
    state.draw = true
    return
  }
  if (hostEmpty) state.winner = 'host'
  if (guestEmpty) state.winner = 'guest'
}

function createInitialState() {
  const deck = buildDeck()
  const state = {
    deck,
    trumpSuit: deck[0].suit,
    trumpCard: { ...deck[0] },
    hands: { host: [], guest: [] },
    attackerRole: 'host',
    defenderRole: 'guest',
    phase: 'attack',
    table: { attacks: [], defends: [] },
    winner: null,
    draw: false,
  }
  takeFromDeck(state, 'host')
  takeFromDeck(state, 'guest')
  return state
}

function applyPlay(state, role, cardId) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.winner || state.draw) return { ok: false, error: 'Партия завершена' }
  if (!cardId) return { ok: false, error: 'Карта не выбрана' }

  const next = cloneState(state)
  const hand = next.hands[role]
  const card = removeCardFromHand(hand, cardId)
  if (!card) return { ok: false, error: 'Карта не найдена в руке' }

  if (next.phase === 'attack') {
    if (role !== next.attackerRole) return { ok: false, error: 'Сейчас не ваш ход атаки' }

    const defenderCount = next.hands[next.defenderRole].length
    if (next.table.attacks.length >= 6 || next.table.attacks.length >= defenderCount) {
      return { ok: false, error: 'Нельзя добавить больше карт в атаку' }
    }

    if (next.table.attacks.length > 0) {
      const ranks = tableRanks(next)
      if (!ranks.has(card.rank)) return { ok: false, error: 'Можно подкидывать только по рангу на столе' }
    }

    next.table.attacks.push(card)
    next.table.defends.push(null)
    next.phase = 'defend'
    return { ok: true, state: next }
  }

  if (next.phase === 'defend') {
    if (role !== next.defenderRole) return { ok: false, error: 'Сейчас ход защищающегося' }

    const idx = next.table.defends.findIndex((c) => c === null)
    if (idx === -1) return { ok: false, error: 'Нет карт для отбоя' }

    const attackCard = next.table.attacks[idx]
    if (!canBeat(card, attackCard, next.trumpSuit)) {
      return { ok: false, error: 'Эта карта не бьёт выбранную' }
    }

    next.table.defends[idx] = card
    if (next.table.defends.every(Boolean)) {
      next.phase = 'attack'
    }
    return { ok: true, state: next }
  }

  return { ok: false, error: 'Неизвестная фаза игры' }
}

function applyDone(state, role) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.winner || state.draw) return { ok: false, error: 'Партия завершена' }
  if (role !== state.attackerRole) return { ok: false, error: 'Только атакующий может завершить раунд' }
  if (state.phase !== 'attack') return { ok: false, error: 'Сейчас нельзя завершить раунд' }
  if (state.table.attacks.length === 0) return { ok: false, error: 'На столе нет карт' }
  if (!state.table.defends.every(Boolean)) return { ok: false, error: 'Есть неотбитые карты' }

  const next = cloneState(state)
  next.table = { attacks: [], defends: [] }

  takeFromDeck(next, next.attackerRole)
  takeFromDeck(next, next.defenderRole)

  const prevDef = next.defenderRole
  next.defenderRole = next.attackerRole
  next.attackerRole = prevDef
  next.phase = 'attack'

  evaluateRoundEnd(next)
  return { ok: true, state: next }
}

function applyTake(state, role) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.winner || state.draw) return { ok: false, error: 'Партия завершена' }
  if (role !== state.defenderRole) return { ok: false, error: 'Только защищающийся может взять карты' }
  if (state.phase !== 'defend') return { ok: false, error: 'Сейчас нельзя брать карты' }
  if (state.table.attacks.length === 0) return { ok: false, error: 'На столе нет карт' }

  const next = cloneState(state)
  const taken = [...next.table.attacks, ...next.table.defends.filter(Boolean)]
  next.hands[next.defenderRole].push(...taken)
  next.table = { attacks: [], defends: [] }

  takeFromDeck(next, next.attackerRole)
  takeFromDeck(next, next.defenderRole)
  next.phase = 'attack'

  evaluateRoundEnd(next)
  return { ok: true, state: next }
}

module.exports = {
  createInitialState,
  applyPlay,
  applyDone,
  applyTake,
}
