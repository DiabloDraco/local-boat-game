import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LobbyView from '../views/LobbyView.vue'
import PlacementView from '../views/PlacementView.vue'
import BattleView from '../views/BattleView.vue'

const routes = [
  { path: '/', component: HomeView },
  { path: '/lobby', component: LobbyView },
  { path: '/placement', component: PlacementView },
  { path: '/battle', component: BattleView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
