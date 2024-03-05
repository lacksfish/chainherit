<template>
    <v-row justify="center">
        <v-dialog
            v-model="show"
            max-width="40%"
        >
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    Delete Wallet ?
                </v-card-title>
                <v-card-text class="d-flex flex-column align-center justify-center">
                    <v-row>
                        You are about to delete the wallet public key for the wallet "{{ walletLabel }}" from your account.
                    </v-row>
                    <v-row >
                        <v-checkbox v-model="confirmDelete" label="I want to delete this wallet public key"></v-checkbox>
                    </v-row>
                    <v-row v-if="txExists">
                        This wallet has a signed inheritance transaction, deleting it will delete this transaction as well.
                    </v-row>
                    <v-row v-if="txExists">
                        <v-checkbox v-model="confirmDeleteTx" label="I want to delete my inheritance transaction"></v-checkbox>
                    </v-row>
                    <v-row class="mb-4" justify="center">
                        <b>Are you sure you wish to continue?</b>
                    </v-row>

                    <div class="text-center" style="margin-top: 10px;">
                        <v-btn
                            color="error darken-1"
                            text
                            :disabled="!confirmDelete || (txExists && !confirmDeleteTx) "
                            @click="deleteWallet(walletLabel)"
                        >
                        DELETE
                        </v-btn>
                    </div>
   
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                        color="green darken-1 primary"
                        text
                        @click="show=false"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>

<script>
import Alert from './Alert.vue'
    export default {
        emits: ["close", "deleteSuccess"],
        props: {
            visible: { type: Boolean },
            value: { type: String },
            txExists: { type: Boolean },
            walletLabel: {type: String }
        },
        data() {
            return {
                confirmDelete: false,
                confirmDeleteTx: false,
                message: {
                    show: false,
                    type: 'info',
                    text: ''
                }
            }
        },
        computed: {
            show: {
                get () {
                    return this.visible
                },
                set (value) {
                    if (!value) {
                        this.$emit('close')
                    }
                }
            }
        },
        methods: {
            async deleteWallet(walletLabel) {
                let data = {
                    walletLabel: walletLabel
                }

                let response = await this.electronAPI.deleteWallet(data)
                if (response.status == 200) {
                    this.$emit('deleteSuccess')
                    this.show=false
                } else if (response.status == 403) {
                    this.message.type = 'error'
                    this.message.text = "Can not delete wallet. Second factor authentication failed."
                    this.message.show = true
                } else {
                    this.message.type = 'error'
                    this.message.text = 'Error deleting wallet public key'
                    this.message.show = true
                }
            }
        },
        watch: {
            'visible'(value) {
                if (value) {
                    this.message.show = false
                    this.confirmDelete = false
                    this.confirmDeleteTx = false
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