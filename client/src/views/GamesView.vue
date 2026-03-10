<template>
  <div class="games-wrap">
    <h1 class="game-title">ИГРЫ</h1>
    <p class="subtitle">Выберите игру</p>

    <div class="games-grid">
      <article class="card game-card">
        <h2 class="game-name">Морской бой</h2>
        <p class="game-desc">Онлайн-дуэль 1 на 1 по коду комнаты</p>
        <button class="btn btn-primary full-width" @click="openBattleship">
          Играть
        </button>
      </article>

      <article class="card game-card">
        <h2 class="game-name">Шашки</h2>
        <p class="game-desc">Классическая игра на двоих</p>
        <button class="btn btn-ghost full-width" @click="openCheckers">
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
  max-width: 820px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.game-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background-image: none !important;
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
    grid-template-columns: 1fr;
    max-width: 420px;
  }
}
</style>
