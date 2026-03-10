const MAX_WRONG = 6

function normalizeWord(word) {
  return (word || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
}

function isValidWord(word) {
  return /^[A-ZА-ЯЁ]{2,24}$/u.test(word)
}

function isValidLetter(letter) {
  return /^[A-ZА-ЯЁ]$/u.test(letter)
}

function createInitialState() {
  return {
    round: 1,
    setterRole: 'host',
    guesserRole: 'guest',
    phase: 'set_word', // set_word | guess | finished
    secretWord: '',
    masked: [],
    guessedLetters: [],
    wrongLetters: [],
    wrongCount: 0,
    maxWrong: MAX_WRONG,
    scores: { host: 0, guest: 0 },
    winner: null,
    draw: false,
  }
}

function createMasked(word) {
  return Array.from({ length: word.length }, () => '_')
}

function revealLetters(secretWord, masked, letter) {
  const next = [...masked]
  let found = false
  for (let i = 0; i < secretWord.length; i++) {
    if (secretWord[i] === letter) {
      next[i] = letter
      found = true
    }
  }
  return { masked: next, found }
}

function finalizeRound(state, guessedSuccessfully) {
  if (guessedSuccessfully) {
    const points = Math.max(1, state.maxWrong - state.wrongCount)
    state.scores[state.guesserRole] += points
  }

  if (state.round === 1) {
    state.round = 2
    const prevSetter = state.setterRole
    state.setterRole = state.guesserRole
    state.guesserRole = prevSetter
    state.phase = 'set_word'
    state.secretWord = ''
    state.masked = []
    state.guessedLetters = []
    state.wrongLetters = []
    state.wrongCount = 0
    return
  }

  state.phase = 'finished'
  if (state.scores.host === state.scores.guest) {
    state.draw = true
    return
  }
  state.winner = state.scores.host > state.scores.guest ? 'host' : 'guest'
}

function setWord(state, role, rawWord) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.phase !== 'set_word') return { ok: false, error: 'Сейчас нельзя загадывать слово' }
  if (state.setterRole !== role) return { ok: false, error: 'Слово загадывает другой игрок' }

  const word = normalizeWord(rawWord)
  if (!isValidWord(word)) {
    return { ok: false, error: 'Слово: 2-24 буквы, только алфавит' }
  }

  const next = {
    ...state,
    phase: 'guess',
    secretWord: word,
    masked: createMasked(word),
    guessedLetters: [],
    wrongLetters: [],
    wrongCount: 0,
  }

  return { ok: true, state: next }
}

function guessLetter(state, role, rawLetter) {
  if (!state) return { ok: false, error: 'Игра не инициализирована' }
  if (state.phase !== 'guess') return { ok: false, error: 'Сейчас нельзя угадывать' }
  if (state.guesserRole !== role) return { ok: false, error: 'Сейчас угадывает другой игрок' }

  const letter = normalizeWord(rawLetter)
  if (!isValidLetter(letter)) return { ok: false, error: 'Введите одну букву' }
  if (state.guessedLetters.includes(letter) || state.wrongLetters.includes(letter)) {
    return { ok: false, error: 'Эта буква уже была' }
  }

  const next = {
    ...state,
    masked: [...state.masked],
    guessedLetters: [...state.guessedLetters],
    wrongLetters: [...state.wrongLetters],
    scores: { ...state.scores },
  }

  const reveal = revealLetters(next.secretWord, next.masked, letter)
  if (reveal.found) {
    next.masked = reveal.masked
    next.guessedLetters.push(letter)
  } else {
    next.wrongCount += 1
    next.wrongLetters.push(letter)
  }

  const solved = next.masked.every((ch) => ch !== '_')
  const failed = next.wrongCount >= next.maxWrong

  if (solved) finalizeRound(next, true)
  if (failed) finalizeRound(next, false)

  return { ok: true, state: next }
}

module.exports = {
  createInitialState,
  setWord,
  guessLetter,
}
