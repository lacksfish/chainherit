<template>
  <v-app style="font-family: 'Poppins-Regular', sans-serif;">
    <v-app-bar color="primary">

      <v-tabs v-if="!initialSetup && !walletSyncing" fixed-tabs>
        <v-tab to="/wallets">Wallets</v-tab>
        <v-tab to="/recipients">Recipients</v-tab>
        <v-tab to="/distributions">Distributions</v-tab>
        <v-tab to="/settings">Settings</v-tab>
        <v-divider></v-divider>
      </v-tabs>
      <v-spacer />
      <v-chip v-if='network' variant="flat" prepend-icon="mdi-bitcoin" label :color="network =='BTC' ? 'orange' : 'black'" size="x-large" style="margin-right: 1vw;">
        {{ network == 'BTC' ? 'Mainnet' : network == 'TBTC' ? 'Testnet' : 'NETWORK IS UNKNOWN'}}
      </v-chip>
      <v-chip v-if="electrumConnected && !initialSetup" color="green" variant="flat" prepend-icon="mdi-lan-connect" label size="x-large" style="margin-right: 1vw;">
        Connected
      </v-chip>
      <v-chip v-if="!electrumConnected && !initialSetup" variant="flat" prepend-icon="mdi-lan-disconnect" label size="x-large" style="margin-right: 1vw;" @click="connectNode()">
        Disconnected
      </v-chip>
    </v-app-bar>

    <!-- <v-navigation-drawer color="grey-darken-2" permanent></v-navigation-drawer> -->
    <v-main>
      <Suspense>
          <MenuFrame>
            <div class="mainMenu">
              <router-view id="router"></router-view>
            </div>
          </MenuFrame>
        <template #fallback>
          Error, contact support or try again later...
        </template>
      </Suspense>
    </v-main>
    <v-footer color="primary darken-4" padless class="text-center" style="max-height: 7vh">
      <v-container>
        <v-row>
          <v-col class="text-center" style="padding: unset !important;">
            <p>&copy; {{ currentYear }} Chainherit</p>
          </v-col>
        </v-row>
      </v-container>
    </v-footer>
  </v-app>
</template>

<script>
import MenuFrame from './components/partials/MenuFrame.vue'
import Vuex from 'vuex'

export default {
  name: 'App',
  async mounted() {
    this.electronAPI.on('event:initialSetup', (state) => {
      this.$store.commit('setInitialSetup', state)
    })
    this.electronAPI.on('event:electrumConnected', (state) => {
      console.log('Electrum connected:', state)
      this.$store.commit('setElectrumConnected', state)
    })
    this.electronAPI.on('event:walletSync', (state) => {
      this.$store.commit('setWalletSyncing', state)
    })

    this.network = await this.electronAPI.getNetwork()
  },
  computed: {
    ...Vuex.mapState([
      'electrumConnected',
      'initialSetup',
      'walletSyncing'
    ])
  },
  data() {
    return {
      currentYear: new Date().getFullYear(),
      network: null
    }
  },
  methods: {
    connectNode() {
      this.electronAPI.connectNode()
    }
  },
  components: {
    MenuFrame
  }
};
</script>

<style>
table tr td,
table tr th {
  text-align: center;
}

.v-row {
  text-align: center;
}

.v-card {
  height: 100%;
}

@font-face {
  font-family: 'Poppins-Regular';
  src: url('./fonts/Poppins-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'Poppins-SemiBold';
  src: url('./fonts/Poppins-SemiBold.ttf') format('truetype');
}

.btn-appbar {
  color: black;
  background: #ff5722;
  margin-left: 5px;
}

#app {
  max-width: unset;
  margin: unset;
  padding: unset;
}


.mainMenu {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;

  width: 90%;
}

#router {
  min-width: 100%;
  min-height: 100%;
  height: 100%;
}

.button-row {
  padding: 1vh;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
}

.card-btn-primary {
  background-color: #04b1b7 !important;
  color: #fff !important;
}

/* Center datepicker input */
.dp__input_wrap > input {
  text-align: center !important;
}

/* Disable scrollbar */
::-webkit-scrollbar {
  display: none;
}
</style>
