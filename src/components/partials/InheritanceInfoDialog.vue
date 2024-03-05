<template>
    <v-row justify="center">
        <v-dialog v-model="show" max-width="75%">
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    Inheritance Transaction Information
                </v-card-title>
                <v-card-text v-if="inheritance.totalInputAmount > 0">
                    Your current active inheritance transaction is:

                    <v-table density="compact">
                        <thead>
                            <tr>
                                <th class="text-center">
                                    Recipient Label
                                </th>
                                <th class="text-center">
                                    Address
                                </th>
                                <th class="text-center">
                                    BTC
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="r in inheritance.outputs" :key="r.id">
                                <td class="text-center">
                                    {{ r.recipient }}
                                </td>
                                <td class="text-center">
                                    {{ r.address }}
                                </td>
                                <td class="text-center">
                                    {{ r.value / 1e8 }}
                                </td>

                            </tr>

                        </tbody>
                    </v-table>
                    
                    <v-table density="compact" class="mt-6">
                        <thead>
                        </thead>
                        <tbody>
                            <tr v-for="item in inheritanceInfoTableData(inheritance)" :key="item.description">
                                <td class="text-left" style="padding-left: 50px;">{{ item.description }}</td>
                                <td class="text-right">{{ item.amount }}&nbsp;</td>
                                <td class="text-left">&nbsp;{{ item.unit }}</td>
                            </tr>
                        </tbody>
                    </v-table>
                    
                    <v-row>
                        <v-col cols="12">
                            Inheritance validity date:
                                <b>{{ new Date(inheritance.locktime).toLocaleDateString('en-US', {day: 'numeric', month: 'long', year: 'numeric'}) }}</b>
                            <div class="my-2 d-flex align-center justify-center">
                                <v-icon class="mr-2">mdi-arrow-right-bold</v-icon>
                                <h3>
                                    <b>Valid in {{ Math.floor((new Date(this.locktimeDate.getFullYear(), this.locktimeDate.getMonth(), this.locktimeDate.getDate()) - new Date()) / (1000 * 60 * 60 * 24)) }} days</b>
                                </h3>
                            </div>
                        </v-col>
                    </v-row>

                    <v-row>
                        <v-col cols="12">
                            <v-btn color="primary" @click="copyToClipboard(inheritance)">Copy signed transaction to clipboard</v-btn>
                        </v-col>
                        <v-col cols="12">
                            <v-btn color="primary" @click="createPdf()">Regenerate inheritance transaction</v-btn>
                        </v-col>
                    </v-row>
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

import Alert from './Alert.vue'
import { createInheritancePdf } from '../../utils'

export default {
    setup() {
        return {
            v$: useVuelidate()
        }
    },
    emits: ['close'],
    props: {
        visible: { type: Boolean },
        walletLabel: { type: String },
    },
    data() {
        return {
            inheritance: {
                outputs: [],
                locktime: null,
                locktimeDate: null,
                totalAmount: 0,
            },
            message: {
                show: false,
                type: 'info',
                text: ''
            }
        }
    },
    validations() {
        return {}
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
        async fetchTransactionData() {
            let data = {
                walletLabel: this.walletLabel
            }

            let res = await this.electronAPI.getTxInfo(data)
            if (res.status == 200) {
                this.inheritance = res
                this.locktimeDate = new Date(this.inheritance.locktime)
            } else if (res.status == 403) {
                this.message.show = true
                this.message.type = 'error'
                this.message.text = 'Invalid password or 2FA code.'
            } else {
                this.message.show = true
                this.message.type = 'error'
                this.message.text = 'Can not display transaction information.'
            }
        },
        inheritanceInfoTableData: (inheritance) => {
            return [
                {
                    description: "Total value sent",
                    amount: (inheritance.totalInputAmount / 1e8).toFixed(8),
                    unit: "BTC"
                },
                {
                    description: "Total payout to recipients",
                    amount: (inheritance.totalOutputAmount / 1e8).toFixed(8),
                    unit: "BTC"
                },
                {
                    description: "Network fee",
                    amount: ((inheritance.totalInputAmount - inheritance.totalOutputAmount) / 1e8).toFixed(8),
                    unit: "BTC"
                },
                {
                    description: "Transaction Size",
                    amount: inheritance.txSize,
                    unit: "bytes"
                },
                {
                    description: "Transaction Fee Rate",
                    amount: ((inheritance.totalInputAmount - inheritance.totalOutputAmount) / inheritance.txSize).toFixed(1),
                    unit: "sat/vB"
                }     
            ]
        },
        copyToClipboard(inheritance) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(inheritance.transaction)
            } else {
                let textArea = document.createElement('textarea')
                textArea.value = inheritance.transaction
                document.body.appendChild(textArea)
                textArea.focus()
                textArea.select()
                try {
                    document.execCommand('copy')
                    document.body.removeChild(textArea)
                    return Promise.resolve()
                } catch (err) {
                    document.body.removeChild(textArea)
                    return Promise.reject(err)
                }
            }
        },
        createPdf() {
            try {
                createInheritancePdf(this.inheritance, this.locktimeDate, this.inheritance.transaction)
            } catch (e) {
                this.message.text = "Failed to create PDF. Please try again or report this issue."
                this.message.type = "error"
                this.message.show = true
            }
        }
    },
    watch: {
        // whenever question changes, this function will run
        'visible'(value) {
            if (value) {
                this.fetchTransactionData()
                this.message.show = false
                this.v$.$reset()
            } else {
                this.inheritance = {
                    outputs: [],
                    locktime: null,
                    totalAmount: 0,
                }
            }
        }
    },
    components: {
        Alert
    }
}
</script>