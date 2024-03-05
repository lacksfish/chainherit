<template>
    <v-row justify="center">
        <v-dialog v-model="show" max-width="75%">
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    {{ !editRecipient ? deleteRecipient ? 'Delete' : 'Add' : 'Edit' }} a recipient
                </v-card-title>
                <v-card-text>
                    {{ !editRecipient ? deleteRecipient ? 'Delete' : 'Add' : 'Edit' }} a recipient for inheritance
                    transactions

                    <v-form>
                        <v-text-field prepend-icon="mdi-rename" name="recipientLabel" label="Label" type="text"
                            v-model="recipientLabel" :readonly="deleteRecipient" :error-messages="recipientLabelErrors"
                            @change="v$.recipientLabel.$touch()" @blur="v$.recipientLabel.$touch()"></v-text-field>
                        <v-text-field prepend-icon="mdi-inbox-arrow-down" name="recipientAddress" label="Address"
                            type="text" v-model="recipientAddress" :readonly="deleteRecipient"
                            :error-messages="recipientAddressErrors" @change="v$.recipientAddress.$touch()"
                            @blur="v$.recipientAddress.$touch()"></v-text-field>
                    </v-form>

                    <div class="text-center" style="margin-top: 10px;">
                        <v-btn color="primary darken-1" text :disabled="this.v$.$invalid"
                            @click="!editRecipient ? deleteRecipient ? delRecipient() : addNewRecipient() : updateRecipient()">
                            {{ !editRecipient ? deleteRecipient ? 'Delete' : 'Add' : 'Update' }} recipient
                        </v-btn>
                    </div>
                </v-card-text>
                <v-card-actions>
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
import useVuelidate from '@vuelidate/core'
import { required } from '@vuelidate/validators'

import { address, networks } from 'bitcoinjs-lib'

import Alert from './Alert.vue'

export default {
    setup() {
        return {
            v$: useVuelidate()
        }
    },
    emits: ['close'],
    props: {
        visible: { type: Boolean },
        edit: { type: Boolean },
        delete: { type: Boolean },
        rLabel: { type: String },
        rAddress: { type: String }
    },
    data() {
        return {
            recipientLabel: '',
            recipientAddress: '',
            editRecipient: false,
            deleteRecipient: false,
            message: {
                show: false,
                type: 'info',
                text: ''
            }
        }
    },
    validations() {
        const addressValidator = async (value) => {
            let network = await this.electronAPI.getNetwork()
            try {
                if (network == 'BTC') {
                    address.toOutputScript(value, networks.bitcoin)
                } else if(network == 'TBTC') {
                    address.toOutputScript(value, networks.testnet)
                } else {
                    return false
                }
                return true
            } catch (e) {
                return false
            }
        }
        return {
            recipientAddress: { required, addressValidator },
            recipientLabel: { required }
        }
    },
    computed: {
        recipientAddressErrors() {
            if (this.v$.recipientAddress.$errors) {
                return this.v$.recipientAddress.$errors.map((err) => { return "Invalid Address" })
            } else {
                return false
            }
        },
        recipientLabelErrors() {
            if (this.v$.recipientLabel.$errors) {
                return this.v$.recipientLabel.$errors.map((err) => { return err.$message })
            } else {
                return false
            }
        },
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
        async addNewRecipient() {
            let data = {
                address: this.recipientAddress,
                label: this.recipientLabel
            }

            let response = await this.electronAPI.postRecipient(data)

            if (response.status == 409) {
                this.message.type = 'error'
                this.message.text = 'Label or address already exists for another recipient!'
                this.message.show = true
            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not add recipient. Second factor authentication failed."
                this.message.show = true
            } else if (response.status != 200) {
                this.message.type = 'error'
                if (response.errors && response.errors.length > 0) {
                    this.message.text = response.errors[0]
                } else {
                    this.message.text = "An unknown error has occured. Please contact support."
                }
                this.message.show = true
            } else {
                this.recipientAddress = ''
                this.label = ''
                this.show = false
                this.message.show = false
            }
        },
        async updateRecipient() {
            let data = {
                address: this.recipientAddress,
                label: this.recipientLabel,
                oldAddress: this.rAddress,
                oldLabel: this.rLabel
            }

            let response = await this.electronAPI.putRecipient(data)
            if (response.status == 409) {
                this.message.type = 'error'
                this.message.text = 'Label or address already exists for another recipient!'
                this.message.show = true

            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not edit recipient. Second factor authentication failed."
                this.message.show = true
            } else if (response.status != 200) {
                this.message.type = 'error'
                this.message.text = "An unknown error has occured. Please contact support."
                this.message.show = true
            } else {
                this.recipientAddress = ''
                this.label = ''
                this.show = false
            }
        },
        async delRecipient() {
            let data = {
                address: this.recipientAddress,
                label: this.recipientLabel
            }

            let response = await this.electronAPI.deleteRecipient(data)
            if (response.status == 409) {
                this.message.type = 'error'
                this.message.text = 'Can not delete recipient, as it is used in a Distribution which would have to be deleted first'
                this.message.show = true
            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not delete recipient. Second factor authentication failed."
                this.message.show = true
            } else if (response.status != 200) {
                this.message.type = 'error'
                this.message.text = "An unknown error has occured. Please contact support."
                this.message.show = true
            } else {
                this.recipientAddress = ''
                this.label = ''
                this.show = false
            }
        }
    },
    watch: {
        // whenever question changes, this function will run
        'visible'(value) {
            if (value) {
                this.message.show = false
                if (this.editRecipient || this.delRecipient) {
                    this.recipientLabel = this.rLabel
                    this.recipientAddress = this.rAddress
                } else {
                    this.recipientLabel = ""
                    this.recipientAddress = ""
                }
                this.editRecipient = this.edit
                this.deleteRecipient = this.delete
                this.v$.$reset()
            }
        }
    },
    components: {
        Alert
    }
}
</script>