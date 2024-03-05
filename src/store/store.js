import Vuex from 'vuex'

export default new Vuex.Store({
    state: {
        electrumConnected: null,
        initialSetup: false,
        walletSyncing: false,
    },
    mutations: {
        setElectrumConnected(state, payload) {
            state.electrumConnected = payload
        },
        setInitialSetup(state, payload) {
            state.initialSetup = payload
        },
        setWalletSyncing(state, payload) {
            state.walletSyncing = payload
        },
    }
})