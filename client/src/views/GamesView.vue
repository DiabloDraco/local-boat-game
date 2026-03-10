<template>
  <div class="games-wrap">
    <h1 class="game-title">ИГРЫ</h1>
    <p class="subtitle">Выберите игру</p>

    <div class="games-grid">
      <article class="card game-card">
        <div class="game-cover battleship-cover" aria-hidden="true">
          <span class="cover-badge">10x10</span>
        </div>
        <h2 class="game-name">Морской бой</h2>
        <p class="game-desc">Онлайн-дуэль 1 на 1 по коду комнаты</p>
        <button class="btn btn-primary full-width" @click="openBattleship">
          Играть
        </button>
      </article>

      <article class="card game-card">
        <div class="game-cover checkers-cover" aria-hidden="true">
          <div class="cover-checkers">
            <span class="cover-piece light"></span>
            <span class="cover-piece dark"></span>
          </div>
        </div>
        <h2 class="game-name">Шашки</h2>
        <p class="game-desc">Классическая игра на двоих</p>
        <button class="btn btn-primary full-width" @click="openCheckers">
          Играть
        </button>
      </article>

      <article class="card game-card">
        <div class="game-cover ttt-cover" aria-hidden="true">
          <div class="ttt-lines"></div>
          <span class="ttt-x">X</span>
          <span class="ttt-o">O</span>
        </div>
        <h2 class="game-name">Крестики-нолики</h2>
        <p class="game-desc">Быстрая партия 3x3 на двоих</p>
        <button class="btn btn-primary full-width" @click="openTicTacToe">
          Играть
        </button>
      </article>

      <article class="card game-card">
        <div class="game-cover durak-cover" aria-hidden="true">
          <div class="durak-card">A♠</div>
          <div class="durak-card back"></div>
        </div>
        <h2 class="game-name">Дурак</h2>
        <p class="game-desc">Карточная онлайн-игра на двоих</p>
        <button class="btn btn-primary full-width" @click="openDurak">
          Играть
        </button>
      </article>

      <article class="card game-card">
        <div class="game-cover hangman-cover" aria-hidden="true">
          <div class="hangman-word">_ _ _ _</div>
          <div class="hangman-bar"></div>
          <div class="hangman-mark">?</div>
        </div>
        <h2 class="game-name">Виселица дуэль</h2>
        <p class="game-desc">2 раунда: загадывайте и угадывайте</p>
        <button class="btn btn-primary full-width" @click="openHangman">
          Играть
        </button>
      </article>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function openBattleship() {
  router.push('/battleship')
}

function openCheckers() {
  router.push('/checkers')
}

function openTicTacToe() {
  router.push('/tic-tac-toe')
}

function openDurak() {
  router.push('/durak')
}

function openHangman() {
  router.push('/hangman-duel')
}
</script>

<style scoped>
.games-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 24px;
}

.games-grid {
  width: 100%;
  max-width: 1240px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background-image: none !important;
}

.game-cover {
  width: 100%;
  height: 140px;
  border: 1px solid var(--line);
  border-radius: 4px;
  position: relative;
  overflow: hidden;
}

.battleship-cover {
  background:
    linear-gradient(transparent 96%, rgba(255,255,255,0.35) 96%),
    linear-gradient(90deg, transparent 96%, rgba(255,255,255,0.35) 96%),
    radial-gradient(circle at 70% 30%, rgba(255,255,255,0.28), rgba(255,255,255,0) 40%),
    linear-gradient(180deg, #4d89b4 0%, #2f5f86 70%, #274f70 100%);
  background-size: 20px 20px, 20px 20px, auto, auto;
}

.battleship-cover::before {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: 24%;
  height: 12px;
  background: #f6f3ea;
  border-radius: 8px 8px 2px 2px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.2);
}

.battleship-cover::after {
  content: '';
  position: absolute;
  left: 58%;
  bottom: 32%;
  width: 30px;
  height: 8px;
  background: #f6f3ea;
  border-radius: 6px 6px 0 0;
}

.cover-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 8px;
  font-size: 11px;
  letter-spacing: 1px;
  font-weight: 700;
  border-radius: 999px;
  background: rgba(14, 42, 66, 0.6);
  color: #f8fbff;
}

.checkers-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(45deg, #8e5e2f 25%, #dfcfb0 25%, #dfcfb0 50%, #8e5e2f 50%, #8e5e2f 75%, #dfcfb0 75%, #dfcfb0 100%);
  background-size: 44px 44px;
}

.cover-checkers {
  display: flex;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(1px);
}

.cover-piece {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.25);
}

.cover-piece.light {
  background: radial-gradient(circle at 35% 35%, #ffffff, #d9d9d9 65%, #b8b8b8);
}

.cover-piece.dark {
  background: radial-gradient(circle at 35% 35%, #5b5b5b, #232323 68%, #111111);
}

.ttt-cover {
  background: linear-gradient(150deg, #ebf2fa 0%, #d7e6f6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ttt-lines {
  position: absolute;
  inset: 18px;
  background:
    linear-gradient(90deg, transparent 31%, rgba(28, 61, 92, 0.35) 31%, rgba(28, 61, 92, 0.35) 34%, transparent 34%, transparent 66%, rgba(28, 61, 92, 0.35) 66%, rgba(28, 61, 92, 0.35) 69%, transparent 69%),
    linear-gradient(180deg, transparent 31%, rgba(28, 61, 92, 0.35) 31%, rgba(28, 61, 92, 0.35) 34%, transparent 34%, transparent 66%, rgba(28, 61, 92, 0.35) 66%, rgba(28, 61, 92, 0.35) 69%, transparent 69%);
}

.ttt-x,
.ttt-o {
  position: absolute;
  font-size: 44px;
  font-weight: 900;
  line-height: 1;
}

.ttt-x {
  left: 26%;
  top: 34%;
  color: #2f5f86;
}

.ttt-o {
  right: 24%;
  bottom: 28%;
  color: #8b5a2b;
}

.durak-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: linear-gradient(145deg, #f1eadc 0%, #e6dbc7 100%);
}

.durak-card {
  width: 62px;
  height: 92px;
  border-radius: 6px;
  border: 1px solid #cabca3;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  font-weight: 800;
  color: #1c3d5c;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.durak-card.back {
  background:
    linear-gradient(45deg, #2f5f86 25%, #e6eef6 25%, #e6eef6 50%, #2f5f86 50%, #2f5f86 75%, #e6eef6 75%, #e6eef6 100%);
  background-size: 16px 16px;
}

.hangman-cover {
  background: linear-gradient(160deg, #f3ebd9 0%, #e7dcc4 100%);
}

.hangman-word {
  position: absolute;
  left: 14px;
  bottom: 16px;
  font-family: 'Courier New', monospace;
  font-size: 30px;
  letter-spacing: 4px;
  color: #6b5d45;
  font-weight: 700;
}

.hangman-bar {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 56px;
  height: 78px;
  border-left: 4px solid #8b6e43;
  border-top: 4px solid #8b6e43;
}

.hangman-bar::after {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  width: 2px;
  height: 14px;
  background: #8b6e43;
}

.hangman-mark {
  position: absolute;
  right: 4px;
  top: 34px;
  font-size: 30px;
  color: #2f5f86;
  font-weight: 900;
}

.game-card::before,
.game-card::after {
  display: none !important;
}

.game-name {
  font-size: 24px;
  line-height: 1.2;
}

.game-desc {
  color: var(--ink-mid);
  min-height: 40px;
}

.full-width {
  width: 100%;
}

@media (max-width: 760px) {
  .games-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    max-width: 420px;
  }
}

@media (min-width: 761px) and (max-width: 1100px) {
  .games-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-width: 820px;
  }
}
</style>
