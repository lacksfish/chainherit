<template>
    <v-row justify="center">
        <v-dialog persistent v-model="show" max-width="75%">
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    Add a Master Public Key
                </v-card-title>

                <v-card-text>
                    <div>
                        <v-row v-if="isLoading" justify="center">
                            <v-col cols="12" style="padding: 1vw">
                                <h2>Syncing wallet - Please wait</h2>
                                <v-progress-linear indeterminate color="primary"></v-progress-linear>
                            </v-col>
                        </v-row>

                        <v-row v-if="!isLoading" justify="center">
                            <v-col cols="12" style="text-align: left">
                                Add a new Master Public Key for inheritance transactions

                            <v-form>
                                <v-text-field prepend-icon="mdi-rename" name="publicKeyLabel"
                                    label="Enter a label for your Master Public Key" type="text"
                                    v-model="publicKeyLabel"></v-text-field>
                                <v-text-field prepend-icon="mdi-key" name="publicKey" label="Enter new Master Public Key"
                                    type="text" v-model="publicKey"></v-text-field>
                            </v-form>

                            <div class="text-center" style="margin-top: 10px;">
                                <v-btn color="primary darken-1" text @click="addNewPubkey()">
                                    Add Master Public Key
                                </v-btn>
                            </div>
                            </v-col>
                        </v-row>
                    </div>
                </v-card-text>

                <v-card-actions v-if="!isLoading">
                    <v-spacer></v-spacer>
                    <v-btn color="green darken-1 primary" text @click="show = false">
                        Close
                    </v-btn>
                </v-card-actions>

            </v-card>
        </v-dialog>
    </v-row>
</template>

<script>
import Alert from './Alert.vue'

export default {
    emits: ['close'],
    props: {
        visible: { type: Boolean }
    },
    data() {
        return {
            publicKey: null,
            publicKeyLabel: null,
            message: {
                show: false,
                type: 'info',
                text: ''
            },
            isLoading: false
        }
    },
    computed: {
        show: {
            get() {
                return this.visible
            },
            set(value) {
                if (!value) {
                    this.$emit('close')
                }
            }
        }
    },
    methods: {
        async addNewPubkey() {
            let data = {
                publicKey: this.publicKey,
                publicKeyLabel: this.publicKeyLabel
            }

            this.isLoading = true
            let response = await this.electronAPI.postPublicKey(data)
            this.isLoading = false

            if (response.status == 422) {
                this.message.type = 'error'
                this.message.text = 'Root public key has invalid checksum!'
                this.message.show = true
            } else if (response.status == 409) {
                this.message.type = 'error'
                this.message.text = 'Label or public key already exists for another wallet!'
                this.message.show = true
            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not add public key. Second factor authentication failed."
                this.message.show = true
            } else if (response.status != 200) {
                this.message.type = 'error'
                this.message.text = "An unknown error has occured. Please contact support."
                this.message.show = true
            } else {
                await this.electronAPI.resubscribeAddresses()
                this.publicKey = ''
                this.publicKeyLabel = ''
                this.show = false
                this.message.show = false
            }
        },
    },
    watch: {
        'visible'(value) {
            if (value) {
                this.message.show = false
                this.publicKey = ""
                this.publicKeyLabel = ""
            }
        }
    },
    components: {
        Alert
    }
}
</script>

<style scoped>
</style>