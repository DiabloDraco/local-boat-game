import { createRouter, createWebHistory } from 'vue-router'
import GamesView from '../views/GamesView.vue'
import HomeView from '../views/HomeView.vue'
import CheckersView from '../views/CheckersView.vue'
import TicTacToeView from '../views/TicTacToeView.vue'
import DurakView from '../views/DurakView.vue'
import HangmanView from '../views/HangmanView.vue'
import LobbyView from '../views/LobbyView.vue'
import PlacementView from '../views/PlacementView.vue'
import BattleView from '../views/BattleView.vue'

const routes = [
  { path: '/', component: GamesView },
  { path: '/battleship', component: HomeView },
  { path: '/checkers', component: CheckersView },
  { path: '/tic-tac-toe', component: TicTacToeView },
  { path: '/durak', component: DurakView },
  { path: '/hangman-duel', component: HangmanView },
  { path: '/lobby', component: LobbyView },
  { path: '/placement', component: PlacementView },
  { path: '/battle', component: BattleView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
