<template>
    <v-row justify="center">
        <v-dialog v-model="show" persistent max-width="75%">
            <Alert v-model="message.show" :type="message.type" :text="message.text" :closable="message.closable"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    {{ step == 0 ? 'Overwrite inheritance transaction' : step == 1 ? 'Inheritance Transaction Setup' : step == 2 ? 'Sign transaction' : step == 3 ? 'Submit transaction' : 'Transaction validated' }}
                </v-card-title>
                <v-card-text>
                    <div v-if="step == 0">
                        <v-row class="d-flex flex-column align-center justify-center">
                            This wallet already has a signed inheritance transaction, creating a new transaction will overwrite the previous!
                        </v-row>
                        <v-row class="d-flex flex-column align-center justify-center">
                            <v-checkbox v-model="overwriteTx" label="I want to create a new inheritance transaction for this wallet"></v-checkbox>
                        </v-row>
                    </div>

                    <div v-if="step == 1 && !isLoading">
                        <h3 class="mb-3 text-center">Select a distribution to use for the inheritance transaction</h3>
                        <v-row align="center" justify="center">
                            <v-col cols="4">
                                <v-select
                                    hide-details return-object single-line
                                    prepend-icon="mdi-chart-pie" v-model="selectedDistribution" :items="distributions"
                                    item-title="label" item-value="address" label="Select a distribution" persistent-hint
                                >
                                </v-select>
                            </v-col>
                        </v-row>
                    </div>

                    <v-table v-if="selectedDistribution && step != 3 && step != 4" density="compact">
                        <thead>
                            <tr>
                                <th class="text-center">
                                    Label
                                </th>
                                <th class="text-center">
                                    {{ selectedDistribution.length > 1 ? 'Recipients' : 'Recipient' }}
                                </th>
                                <th class="text-center">
                                    Percentage
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="distribution in [selectedDistribution]" :key="distribution.void">

                                <td class="text-center"> {{ distribution.label }} </td>
                                <td>
                                    <v-table density="compact">
                                        <thead></thead>
                                        <tbody>
                                            <tr v-for="distShare in distribution.distShares" :key="distShare.void">
                                                <td class="text-center">{{ distShare.recipient.label }} (<b>{{ distShare.recipient.address }}</b>)</td>
                                            </tr>
                                        </tbody>
                                    </v-table>
                                </td>
                                <td>
                                    <v-table density="compact">
                                        <thead></thead>
                                        <tbody>
                                            <tr v-for="distShare in distribution.distShares" :key="distShare.void">
                                                <td class="text-center">{{ distShare.percentage }} %</td>
                                            </tr>
                                        </tbody>
                                    </v-table>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>

                    <v-divider v-if="step != 0 && step != 3 && step != 4" class="mt-6 mb-3"></v-divider>

                    <div v-if="step != 3 && step != 0 && step != 4">
                        <v-row>
                            <v-col v-if="step != 2" cols="12">
                                <h3>Select your inheritance transaction validity date</h3>
                            </v-col>
                            <v-row v-if="step != 2" justify="center">
                                <v-col cols="12" md="4">
                                    <VueDatePicker
                                        v-model="validityDate"
                                        six-weeks="fair"
                                        teleport-center
                                        :disabled="isLoading"
                                        :year-first="true"
                                        :enable-time-picker="false"
                                        :max-date="validityMaxDate"
                                        :min-date="validityMinDate"
                                        class="mb-3">
                                    </VueDatePicker>
                                </v-col>
                            </v-row>
                            <v-col cols="12">
                                Inheritance validity date:
                                    {{ validityDate.toLocaleDateString('en-US', {
                                        day: 'numeric', month: 'long', year:
                                            'numeric'
                                    }) }}
                                <div class="my-2 d-flex align-center justify-center">
                                    <v-icon class="mr-2">mdi-arrow-right-bold</v-icon>
                                    Valid in {{
                                        Math.floor((new Date(validityDate.getFullYear(), validityDate.getMonth(),
                                            validityDate.getDate()) - new Date()) / (1000 * 60 * 60 * 24))
                                    }} days
                                    <v-icon class="ml-2">mdi-arrow-left-bold</v-icon>
                                </div>
                            </v-col>
                        </v-row>
                        

                        <v-row v-if="step == 1 && isLoading" align-content="center" class="fill-height" justify="center">
                            <v-col cols="6">
                                Generating transaction
                            </v-col>
                            <v-col cols="12">
                                <v-progress-linear class="text-center" indeterminate color="primary"></v-progress-linear>
                            </v-col>
                        </v-row>

                        <v-divider v-if="!isLoading" class="mt-6 mb-3"></v-divider>

                        <v-row v-if="step == 1 && !isLoading" align="center" justify="center">
                            <v-col cols="4">
                               <h3 class="mb-3">Set inheritance transaction fee</h3>
                               <v-form ref="feeForm">
                                    <v-text-field
                                        class="centered-input"
                                        label="Transaction Fee (sat/byte)"
                                        outlined
                                        v-model="txFee"
                                        :rules="txFeeRules"
                                    ></v-text-field>
                                </v-form>
                            </v-col>
                            
                            <v-col cols="12" v-if="txFee < 50">
                                <v-card class="text-center" color="orange">
                                    <v-card-text>
                                        The transaction fee is low, which may hinder the ability to publish the transaction in the future.
                                    </v-card-text>
                                </v-card>
                            </v-col>
                        </v-row>
                    </div>

                    <div v-if="step == 2">

                        <div class="text-center">
                            Total balance in this wallet: <b>{{ totalValue / 1e8 }} BTC</b>
                        </div>
                        <div class="mt-4 text-center">
                            Copy this unsigned transaction and sign it.
                        </div>

                        <v-row>
                            <v-col cols="12">
                                <v-expansion-panels>
                                    <v-expansion-panel title="Help">
                                    <v-expansion-panel-text style="text-align: left;">
                                        You can sign this unsigned transaction using Electrum.
                                        <br>
                                        <br>
                                        <v-row>
                                            <v-col cols="12" style="text-align: left;">
                                                <b>Step 1:</b> Open Electrum and go to <b>Tools > Load transaction > From text</b>
                                                <v-img src="electrum_load_tx.png"></v-img>
                                            </v-col>
                                            <v-col cols="12" style="text-align: left;">
                                                <b>Step 2:</b> Load the unsigned transaction. <b>Review the locktime and the outputs.</b>
                                                <v-img src="electrum_tx_summary.png"></v-img>
                                            </v-col>
                                            <v-col cols="12" style="text-align: left;">
                                                <b>Step 3:</b> Sign the transaction (bottom right), and copy the signed transaction (bottom left). You do not need to and can not broadcast the transaction as it is not valid yet.
                                                <v-img src="electrum_sign_copy.png"></v-img>
                                            </v-col>
                                        </v-row>
                                    </v-expansion-panel-text>
                                    </v-expansion-panel>
                                </v-expansion-panels>
                            </v-col>
                        </v-row>

                        <div class="mt-4 mb-4 text-center">
                            <b>! Make sure to review the locktime and output addresses before you sign !</b>
                        </div>


                        <v-textarea id="textarea-utx" filled rounded readonly v-model="unsignedTx"></v-textarea>

                        <div class="text-center" style="margin-top: 10px;">
                            <v-btn color="green darken-1 primary" text @click="copyToClipboard()">
                                Copy to clipboard
                            </v-btn>
                        </div>
                    </div>

                    <div v-if="step == 3">
                        Paste the signed transaction here:

                        <v-textarea id="textarea-utx" filled rounded v-model="signedTx"></v-textarea>
                    </div>


                    <div v-if="step == 4">
                        <v-icon dark left>
                            mdi-check
                        </v-icon>

                        Inheritance transaction has been validated.
                        <br>
                        Validity date is set to: {{ validityDate.toLocaleDateString('en-US', {
                            day: 'numeric', month:
                                'long', year: 'numeric'
                        }) }}
                        <br>
                        <br>
                        {{ showSaveButton ? 'You can now save your inheritance transaction PDF.' : '' }}
                    </div>

                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn v-if="!isLoading" color="green darken-1 primary" text @click="show = false">
                        {{ step != 4 ? 'Cancel' : 'Exit' }}
                    </v-btn>
                    <v-btn v-if="showSaveButton" color="green darken-1 primary" text
                        @click="step == 1 ? genTx() : step == 2 ? step = 3 : step == 3 ? postTx() : step == 0 ? step = 1 : createPdf()"
                        :disabled="(step == 3 && !signedTx) || message.disableContinue || !overwriteTx || this.isLoading || (step == 1 && !isFeeValid)">
                        {{ step != 4 ? 'Continue' : 'Save PDF' }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>

<script>
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Alert from './Alert.vue'
import VueDatePicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

import { createInheritancePdf } from '../../utils'

import logoImg from './../../../public/logo.png'

export default {
    mounted() {
        this.resetValidityDate()
    },
    props: {
        visible: { type: Boolean },
        walletLabel: { type: String },
        publicKey: { type: String },
        transactionExists: { type: Boolean }
    },
    data() {
        return {
            selectedDistribution: null,
            validityDate: null,
            validityMinDate: null,
            validityMaxDate: null,
            distributions: [],

            unsignedTx: '',
            totalValue: 0,
            txFee: 50,
            unconfirmedInputs: false,

            signedTx: '',
            step: 1,
            overwriteTx: true,
            message: {
                show: false,
                text: '',
                type: 'error',
                closable: true,
                disableContinue: false
            },
            showSaveButton: true,
            isLoading: false,

            txFeeRules: [
                value => !!value && !isNaN(value) && value > 0 || 'The fee must be greater than 0',
                value => {
                    const num = parseInt(value, 10)
                    return !isNaN(num) && num.toString() === value.toString() && num > 0 || 'The fee must be a whole number'
                }
            ],
            inheritance: null
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
        },
        isFeeValid() {
            // Ensure txFee is not empty before evaluating rules
            return this.txFee !== '' && this.txFeeRules.every(rule => rule(this.txFee) === true);
        }
    },
    methods: {
        async genTx() {
            this.message.show = false

            if (!this.selectedDistribution) {
                this.message.text = "Please select a distribution before continuing."
                this.message.show = true
                return
            }

            if (!this.validityDate) {
                this.message.text = "Please select a validity date before continuing."
                this.message.show = true
                return
            }

            const data = {
                walletLabel: this.walletLabel,
                distLabel: this.selectedDistribution.label,
                validityDate: this.validityDate.toISOString(),
                txFee: parseInt(this.txFee)
            }

            this.isLoading = true
            let res = await this.electronAPI.postGenTx(data)
            this.isLoading = false
            if (res.status == 200) {
                let data = res
                this.unsignedTx = data.unsignedTx
                this.totalValue = data.totalValue
                this.unconfirmedInputs = data.unconfirmedInputs
                this.step = 2
                if (this.unconfirmedInputs) {
                    this.message.text = "CAREFUL! Your wallet has unconfirmed transactions! If they are not included in a block eventually, your transaction might not become valid."
                    this.message.type = 'warning'
                    this.message.closable = false
                    this.message.show = true
                }
            } else if (res.status == 422) {
                this.message.text = res.errors ? res.errors[0] : "Failed generating transaction. Is your wallet empty?"
                this.message.type = "error"
                this.message.show = true
                this.message.disableContinue = true
            } else {
                this.message.text = "A temporary error has occured. Please contact support."
                this.message.type = "error"
                this.message.show = true
                this.message.disableContinue = true
            }
        },
        async postTx() {
            this.message.show = false

            const data = {
                walletLabel: this.walletLabel,
                distLabel: this.selectedDistribution.label,
                validityDate: this.validityDate.toISOString(),
                unsignedTx: this.unsignedTx,
                signedTx: this.signedTx
            }

            let res = await this.electronAPI.postSignTx(data)

            if (res.status == 200) {
                this.step = 4
                this.message.text = "Transaction created successfully."
                this.message.show = true
                this.message.type = "info"

                this.inheritance = await this.electronAPI.getTxInfo({ walletLabel: this.walletLabel })

            } else if (res.status == 304) {
                this.message.text = "Transaction is identical to the last inheritance transaction. Nothing to do."
                this.message.type = "warning"
                this.message.show = true
                this.showSaveButton = false
            } else if (res.status == 422) {
                this.message.text = res.errors[0]
                this.message.type = "error"
                this.message.show = true
            } else {
                this.message.text = "There was an issue submitting your transaction."
                this.message.type = "error"
                this.message.show = true
            }
        },
        copyToClipboard() {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(this.unsignedTx)
            } else {
                let textArea = document.getElementById('textarea-utx')
                textArea.focus()
                textArea.select()
                return new Promise((res, rej) => {
                    document.execCommand('copy') ? res() : rej()
                })
            }
        },
        resetValidityDate() {
            let validityDate = new Date()
            this.validityMaxDate = new Date(validityDate)
            this.validityMaxDate.setFullYear(validityDate.getFullYear() + 5)
            validityDate.setFullYear(validityDate.getFullYear() + 1)

            this.validityDate = validityDate
            this.validityMinDate = new Date()
            this.validityMinDate.setMonth(this.validityMinDate.getMonth() + 1)
            // remove time from date
            this.validityDate = new Date(this.validityDate.getFullYear(), this.validityDate.getMonth(), this.validityDate.getDate())
            this.validityMinDate = new Date(this.validityMinDate.getFullYear(), this.validityMinDate.getMonth(), this.validityMinDate.getDate())
        },
        createPdf() {
            try {
                createInheritancePdf(this.inheritance, this.validityDate, this.signedTx)
            } catch (e) {
                this.message.text = "Failed to create PDF. Please try again or report this issue."
                this.message.type = "error"
                this.message.show = true
            }
        }
    },
    watch: {
        async 'visible'(value) {
            if (value) {
                if (this.transactionExists) {
                    this.step = 0
                    this.overwriteTx = false
                } else {
                    this.step = 1
                }

                this.unsignedTx = null
                this.signedTx = null
                this.selectedDistribution = null
                this.showSaveButton = true
                this.message.show = false
                this.message.disableContinue = false
                this.resetValidityDate()

                let data = await this.electronAPI.getDistributions()
                this.distributions = data
            }
        }
    },
    components: {
        Alert,
        VueDatePicker
    }
}
</script>
<style>
.v-btn-group .v-btn.v-btn--active {
    font-weight: bolder;
    background-color: orange;
}

.v-progress-circular {
    width: 100% !important;
    overflow-y: hidden;
    overflow-x: hidden;
    margin-bottom: 1vh;
    margin-top: 1vh;
}

.v-field__overlay {
    border-radius: unset !important;
}

.dp__theme_light {
    --dp-primary-color: #04b1b7;
}
input {
    text-align: center
}
</style>