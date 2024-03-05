
// Router
import { createRouter, createWebHashHistory } from 'vue-router'

import Welcome from './../components/Welcome.vue'
import Wallets from './../components/Wallets.vue'
import Recipients from './../components/Recipients.vue'
import Distributions from './../components/Distributions.vue'
import Settings from './../components/Settings.vue'

const routes = [
  {
    path: '/', component: Welcome
  },
  {
    path: '/settings', component: Settings
  },
  {
    path: '/wallets', component: Wallets
  },
  {
    path: '/recipients', component: Recipients
  },
  {
    path: '/distributions', component: Distributions
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router