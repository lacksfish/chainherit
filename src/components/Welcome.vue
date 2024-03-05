<template>
  <v-container fill-height>
    <v-row justify="center" v-if="initialSetup">
      <!-- Welcome Card -->
      <v-col cols="12" md="8" class="mb-4">
        <v-card variant="outlined">
          <v-card-title>Welcome to Chainherit</v-card-title>
          <v-card-text>
            <p>This tool is still in beta.</p>
            <p>If you encounter problems, please <a href="https://github.com/lacksfish/chainherit/issues"
                target="_blank">open an issue on GitHub</a>.</p>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Description Card -->
      <v-col cols="12" md="8" class="mb-4">
        <v-card class="card-left-align">
          <v-card-text>
            <v-card-title>How to</v-card-title>
            <p>Chainherit creates an inheritance transaction in case something bad happens to you:</p>
            <ul>
              <li>You set a validity date for the inheritance transaction and sign it. This validity date, called
                locktime, is enforced by the network consensus rules.</li>
              <li>If something happens to you, the transaction becomes valid on the validity date and your
                beneficiaries can publish the transaction, claiming the funds.</li>
              <li>If you are alive and well, you move your coins before the validity date or destroy all copies of the
                inheritance transaction.</li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8" class="mb-4">
        <v-card class="card-left-align">
          <v-card-text>

            <v-card-title>Wallet state</v-card-title>
            <ul>
              <li><b>If you receive new coins</b>, for them to be covered you need to create a new inheritance
                transaction.</li>
              <li><b>If you spend your coins</b>, you need to create a new inheritance transaction.</li>
            </ul>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8" class="mb-4">
        <v-card class="card-left-align">
          <v-card-text>
            This application stores information about your wallet in a local database on your computer.
            <br><br>
            To encrypt this information, please set a password. Losing the password would mean having to reset this
            application
            and providing the information again.
            <br><br>
            This wallet does not offer signing, you do not need to trust us.
            <br><br>
            We recommend <a href="https://electrum.org" target="_blank">Electrum</a> as it has the features needed to
            sign from many hardware wallets and other kinds of wallets.
            <br><br>
            You can load the transaction in Electrum Wallet via <b>Tools > Load Transaction > From Text</b> and you
            can sign it there.

          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="8" class="mb-4">
        <v-card>
          <v-card-text class="d-flex flex-column align-center justify-center">
            <v-checkbox v-model="accept">
              <template v-slot:label>
                I have read and understood the above
              </template>
            </v-checkbox>
            <v-btn @click="setupPassword()" :disabled="!accept" large color="primary" class="mt-3">Setup my
              password</v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row justify="center" align="center" style="height: 100%;">
      <v-col class="loading-spinner d-flex flex-column justify-center align-center mb-4" v-if="electrumConnected === false && !this.passwordDialog.show" cols="12">
        <div class="warning-message">
          <span class="mdi mdi-alert-circle"></span> The electrum connection has failed.
        </div>
        <v-btn color="primary" @click="nodeDialog=true">Pick another server</v-btn>
      </v-col>

      <v-col class="loading-spinner d-flex flex-column justify-center align-center mb-4" v-if="walletSyncing && electrumConnected !== false" cols="12">
        <v-progress-circular :size="loadingSize" indeterminate color="primary" style="font-size: 2vh; line-height: 2.5vh;">
          Syncing wallets
          <br>
          Please wait
        </v-progress-circular>
      </v-col>
    </v-row>

    
    <v-dialog v-model="nodeDialog" persistent max-width="600px">
      <v-card>
        <v-card-text>
          <Settings />
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="nodeDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <EnterPasswordDialog
      :invalid="passwordDialog.invalid"
      :visible="passwordDialog.show"
      :closeable="false"
      @close="initialSetup ? passwordDialog.show = false : null"
    >
    </EnterPasswordDialog>
  </v-container>
</template>
  
<script>
import MenuFrame from './partials/MenuFrame.vue'
import EnterPasswordDialog from './partials/EnterPasswordDialog.vue'
import Settings from './Settings.vue'
import Vuex from 'vuex'

export default {
  name: "Welcome",
  data() {
    return {
      accept: false,
      passwordDialog: {
        show: false,
        passwordHash: null,
        invalid: false
      },
      nodeDialog: false
    }
  },
  computed: {
    ...Vuex.mapState([
      'electrumConnected',
      'initialSetup',
      'walletSyncing'
    ]),
    loadingSize() {
      return Math.floor(window.innerWidth * 0.2)
    }
  },
  mounted() {
    this.electronAPI.on('event:passwordSuccess', (data) => {
      this.passwordDialog.show = false
    })

    this.handleInitialSetup(this.initialSetup)
    this.handleWalletSyncing(this.walletSyncing)
  },
  methods: {
    setupPassword() {
      this.passwordDialog.show = true
    },
    handleInitialSetup(value) {
        this.passwordDialog.show = !value
    },
    handleWalletSyncing(value) {
      if (value) {
        this.passwordDialog.show = false
      } else if (!value && this.electrumConnected) {
        this.$router.push('/wallets')
      }
    }
  },
  watch: {
    'visible'(value) {
      if (value) {
        this.passwordDialog.show = true
      }
    },
    initialSetup: 'handleInitialSetup',
    walletSyncing: 'handleWalletSyncing',
  },
  components: {
    EnterPasswordDialog,
    MenuFrame,
    Settings
  }
};
</script>

<style scoped>

.loading-spinner {
  min-height: 100%;
}

.v-container {
  min-height: 100%;
}

/* Ensure text is left-aligned within cards */
.card-left-align {
  text-align: justify;
  text-justify: inter-character;
  padding-left: 2vw;
  padding-right: 2vw;
}

.v-card-title {
  text-align: center;
}

.v-progress-circular {
  text-align: center;
  width: 100% !important;
  overflow-y: hidden;
  overflow-x: hidden;
  margin-bottom: 1vh;
  margin-top: 1vh;
}
</style>