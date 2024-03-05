<template>
    <v-container>
        <div style="height: 2vh;"></div>
        <v-row>
            <v-col cols="12">
                <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            </v-col>
        </v-row>

        <div class="settings">
            <v-row justify="center">
                <v-col cols="12">
                    <h2>Electrum Node Settings</h2>
                    <div style="height: 2vh;"></div>
                    <v-form>
                        <v-select label="Electrum Node" v-model="userSettings.selectedNode"
                            :items="electrumNodes"></v-select>
                        <v-text-field v-if="userSettings.selectedNode == '[ CUSTOM NODE ]'" label="Custom Node URL"
                            v-model="userSettings.customNode" placeholder="mycustom.node.com:60002"></v-text-field>
                    </v-form>
                    <v-btn color="primary" class="mt-4" @click="saveSettings()">Save Settings</v-btn>
                </v-col>
            </v-row>
        </div>
    </v-container>
</template>
 
<script>
import MenuFrame from './partials/MenuFrame.vue'
import Alert from './partials/Alert.vue'
import { ref } from 'vue'

export default {
    name: 'Settings',
    async mounted() {
        let network = await this.electronAPI.getNetwork()
        switch (network) {
            case 'TBTC':
                this.electrumNodes = [
                    'electrum.blockstream.info:60002',
                    'testnet.hsmiths.com:53012',
                    'testnet.qtornado.com:51002',
                    '[ CUSTOM NODE ]'
                ]
                break
            case 'BTC':
                this.electrumNodes = [
                    'electrum.blockstream.info:50002',
                    'electrum.jochen-hoenicke.de:50006',
                    'electrum.bitrefill.com:50002',
                    '[ CUSTOM NODE ]'
                ]
                break
        }
    },
    data() {
        return {
            userSettings: {
                selectedNode: null,
                customNode: null
            },
            electrumNodes: [
                '[ CUSTOM NODE ]'
            ],
            message: {
                show: false,
                text: '',
                type: 'error'
            }
        }
    },
    methods: {
        async saveSettings() {
            let nodeConnectionData
            if (this.userSettings.customNode && this.userSettings.selectedNode == '[ CUSTOM NODE ]') {
                try {
                    let [host, port] = this.userSettings.customNode.split(':')
                    nodeConnectionData = [host, parseInt(port)]
                    console.log(nodeConnectionData)
                    if (!nodeConnectionData[0] || !nodeConnectionData[1]) throw new Error()
                } catch (e) {
                    this.message.text = 'Invalid custom node URL.'
                    this.message.show = true
                    this.message.type = 'error'
                    return
                }
            } else {
                let [host, port] = this.userSettings.selectedNode.split(':')
                nodeConnectionData = [host, parseInt(port)]
            }
            // So far I am not sure if I like Proxy usage in VueJS. I must be missing the greater picture.
            let res = await this.electronAPI.selectNode(nodeConnectionData)

            if (res.status == 422) {
                this.message.text = res.errors ? res.errors[0] : "Unknown error occurred."
                this.message.show = true
                this.message.type = 'error'
            } else if (res.status != 200) {
                this.message.text = "Unknown error occurred."
                this.message.show = true
                this.message.type = 'error'
            } else {
                this.message.text = 'Settings saved successfully.'
                this.message.type = 'success'
                this.message.show = true
            }
        },
        async loadSettings() {
            let settings = await this.electronAPI.getSettings()
            this.userSettings.selectedNode = `${settings.electrumNodeUrl}:${settings.electrumNodePort}`
            if (!this.electrumNodes.includes(this.userSettings.selectedNode)) {
                this.userSettings.selectedNode = '[ CUSTOM NODE ]'
                this.userSettings.customNode = `${settings.electrumNodeUrl}:${settings.electrumNodePort}`
            }
        }
    },
    beforeRouteEnter(to, from, next) {
        next(vm => {
            vm.loadSettings()
        })
    },
    components: {
        Alert,
        MenuFrame
    }
}
</script>
 
<style>
.mainMenu {
    justify-content: unset;
}

.settings {
    max-width: 500px;
    margin: 0 auto;
}

h2 {
    margin-top: 2rem;
}

.active-toggle .v-switch__track {
    background-color: green !important;
}

input[type="checkbox"] {
    margin-right: 0.5rem;
}
</style>