<template>
    <div>
        <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>

        <div class="button-row">
            <v-btn color="primary" @click="walletPubkeyDialog.show = true">Add Master Public Key</v-btn>
        </div>
        
        <v-table>
            <thead>
                <tr>
                    <th class="text-center" style="min-width: 3vw;">
                        Status
                    </th>
                    <th class="text-center">
                        Inheritance
                    </th>
                    <th class="text-center">
                        Label
                    </th>
                    <th class="text-center">
                        Master Public Key
                    </th>
                    <th class="text-center">
                        Total Balance ({{ network }})
                    </th>
                    <th class="text-center">
                        Delete
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(wallet, index,) in walletsData" :key="wallet.rootPubKey">
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">
                        <v-btn v-if="wallet.transaction.length" class="btn-tx-info" color="primary"
                            @click="openInheritanceInfoDialog(wallet.label)">
                            <v-icon>
                                {{ wallet.transaction.length ? 'mdi-check' : 'mdi-close-circle' }}
                            </v-icon>
                        </v-btn>
                        <v-icon v-if="!wallet.transaction.length">
                                {{ 'mdi-close-circle' }}
                            </v-icon>
                        <v-tooltip activator="parent" location="top">
                            {{ wallet.transaction.length ? 'This transaction currently has an active insurrance' : 'No inheritance tx exists or tx has been invalidated by spending' }}
                        </v-tooltip>
                    </td>
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">
                        <v-btn
                            :disabled="!electrumConnected"
                            class="ma-2"
                            color="primary"
                            dark
                            @click="openTxDialog(wallet.label, wallet.rootPubKey, wallet.transaction.length > 0)"
                        >
                            <v-icon dark left>
                                {{ wallet.transaction.length == 0 ? 'mdi-plus' : 'mdi-refresh' }}
                            </v-icon>
                            {{ wallet.transaction.length == 0 ? 'Set up' : 'Update' }}
                        </v-btn>
                    </td>
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">{{ wallet.label }}</td>
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">{{ truncPubkeys[index] }}</td>
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">
                        {{ wallet.addresses.length ? wallet.addresses.reduce((acc, address) => {
                            return address.unconfirmedBalance + address.confirmedBalance + acc
                        }, 0) / 1e8 : '---' }}
                    </td>
                    <td :class="wallet.transaction.length ? 'tx-active' : 'tx-inactive'">
                        <v-icon
                            @click="openDeleteWalletDialog(wallet.label, wallet.transaction.length > 0)">mdi-delete</v-icon>
                    </td>
                </tr>
            </tbody>
        </v-table>

        <v-row>
            <v-col cols="12">
                <v-expansion-panels>
                    <v-expansion-panel title="Help">
                    <v-expansion-panel-text style="text-align: justify;">
                        <p>Your wallet's <b>Master Public Key</b> allows for deriving addresses and viewing balances. It does not allow for spending funds.
                        It is used to fetch your wallet's balance and UTXO set.</p>
                        <br>
                        <p>
                        To copy your master public key, in Electrum go to <b>Wallet -> Information</b> and copy the Master Public Key.
                        </p>
                        <br>
                        <v-row>
                            <v-col cols="6">
                                <v-img src="electrum_wallet_information.png"></v-img>
                            </v-col>
                            <v-col cols="6">
                                <v-img src="electrum_master_public_key.png"></v-img>
                            </v-col>
                        </v-row>
                    </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-col>
        </v-row>

        <UnsignedTxDialog :visible="uTxDialog.show" :walletLabel="uTxDialog.walletLabel"
            :publicKey="uTxDialog.publicKey" :transactionExists="uTxDialog.transactionExists"
            @close="uTxDialog.show = false; reloadWallets()"></UnsignedTxDialog>
        <DeleteWalletDialog :visible="deleteDialog.show" :walletLabel="deleteDialog.walletLabel"
            :txExists="deleteDialog.txExists" @close="deleteDialog.show = false" @deleteSuccess="reloadWallets()">
        </DeleteWalletDialog>
        <WalletPubkeyDialog :visible="walletPubkeyDialog.show"
            @close="walletPubkeyDialog.show = false; reloadWallets()">
        </WalletPubkeyDialog>
        <InheritanceInfoDialog :visible="inheritanceInfoDialog.show" :walletLabel="inheritanceInfoDialog.walletLabel"
            @close="inheritanceInfoDialog.show = false;">
        </InheritanceInfoDialog>
    </div>
</template>
 
<script>
import MenuFrame from './partials/MenuFrame.vue'
import Alert from './partials/Alert.vue'
import UnsignedTxDialog from './partials/UnsignedTxDialog.vue'
import DeleteWalletDialog from './partials/DeleteWalletDialog.vue'
import WalletPubkeyDialog from './partials/WalletPubkeyDialog.vue'
import InheritanceInfoDialog from './partials/InheritanceInfoDialog.vue'
import Vuex from 'vuex'

function truncateMiddle(str, maxLength) {
    if (str.length <= maxLength) {
        return str
    }
    let middle = Math.floor(maxLength / 2)
    let start = str.slice(0, middle)
    let end = str.slice(-middle)
    return start + "..." + end
}

export default {
    name: 'Wallets',
    async mounted() {
        let self = this
        this.electronAPI.on('event:reloadWallets', (data) => {
            console.log("Reloading wallets")
            self.reloadWallets()
        })

        this.walletsData = await this.electronAPI.getWallets()
        this.network = await this.electronAPI.getNetwork()
    },
    data() {
        return {
            walletsData: [],

            publicKey: "",
            publicKeyLabel: "",
            uTxDialog: {
                walletLabel: "",
                selectedPublickey: "",
                show: false,
                uTx: '',
                transactionExists: false
            },
            deleteDialog: {
                walletLabel: "",
                txExists: true,

            },
            walletPubkeyDialog: {
                show: false
            },
            inheritanceInfoDialog: {
                walletLabel: "",
                show: false
            },
            message: {
                show: false,
                text: '',
                type: 'error'
            },
            network: "Unknown"
        }
    },
    computed: {
        ...Vuex.mapState([
            'electrumConnected'
        ]),
        truncPubkeys() {
            return this.walletsData.map((currPubkey) => {
                return truncateMiddle(currPubkey.rootPubKey, 32)
            })
        }
    },
    methods: {
        async openDeleteWalletDialog(walletLabel, txExists) {
            this.deleteDialog.walletLabel = walletLabel
            this.deleteDialog.txExists = txExists
            this.deleteDialog.show = true
        },
        async openTxDialog(walletLabel, publicKey, transactionExists) {
            this.uTxDialog.walletLabel = walletLabel
            this.uTxDialog.publicKey = publicKey
            this.uTxDialog.transactionExists = transactionExists
            this.uTxDialog.show = true
        },
        async openInheritanceInfoDialog(walletLabel) {
            this.inheritanceInfoDialog.walletLabel = walletLabel
            this.inheritanceInfoDialog.show = true
        },

        async reloadWallets() {
            console.log('reloadWallets')
            this.deleteDialog.show = false
            this.uTxDialog.show = false
            let res = await this.electronAPI.getWallets()
            this.walletsData = res
        }
    },
    components: {
        DeleteWalletDialog,
        UnsignedTxDialog,
        WalletPubkeyDialog,
        Alert,
        MenuFrame,
        InheritanceInfoDialog
    }
}
</script>
 
<style>
.btn-tx-info {
    margin-left: 2vw;
    margin-right: 2vw;
}

.tx-active {
    background-color: #c8e6c9;
}

.tx-inactive {
    background-color: #ffcdd2;
}

.v-expansion-panel__shadow {
    box-shadow: none !important;
}

.v-expansion-panel {
    background-color: unset;
    border-radius: 0px;
}

.v-expansion-panel--active > .v-expansion-panel-title:not(.v-expansion-panel-title--static) {
    min-height: 64px;
}

.v-expansion-panel-title__overlay {
    opacity: 0 !important;
    background-color: unset !important;
}

.v-expansion-panel-title {
    justify-content: unset;
    width: unset;
    min-height: unset !important;
}

</style>