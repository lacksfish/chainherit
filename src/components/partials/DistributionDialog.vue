<template>
    <v-row justify="center">
        <v-dialog v-model="show" max-width="75%">
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    {{ deleteDistribution ? 'Delete' : 'Add' }} a distribution
                </v-card-title>
                <v-card-text>
                    <div v-if="!deleteDistribution">
                        Add a distribution for inheritance transactions
                    </div>

                    <div v-if="deleteDistribution" class="text-center">
                        {{ 'Are you sure you want to delete distribution: ' + dLabel }}
                    </div>

                    <v-form v-if="!deleteDistribution">
                        <v-text-field prepend-icon="mdi-rename" name="distributionLabel" label="Label" type="text"
                            v-model="distributionLabel" :error-messages="distributionLabelErrors"
                            @change="v$.distributionLabel.$touch()" @blur="v$.distributionLabel.$touch()"></v-text-field>

                        <!-- Dropdown -->
                        <v-select prepend-icon="mdi-account-plus" v-model="selectedRecipient" :items="recipients"
                            item-title="label" item-value="address" label="Select a recipient" persistent-hint return-object
                            single-line></v-select>

                        <v-table density="compact">
                            <thead>
                                <tr>
                                    <th class="text-center">
                                        Label
                                    </th>
                                    <th class="text-center">
                                        Address
                                    </th>
                                    <th class="text-center">
                                        Percentage
                                    </th>
                                    <th class="text-center" v-if="this.distribution.length > 2">
                                        Lock
                                    </th>
                                    <th class="text-center">
                                        Remove
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr class="text-center" v-for="(recipient, idx) in distribution" :key="recipient.address">
                                    <td>{{ recipient.label }}</td>
                                    <td> {{ recipient.address }} </td>
                                    <td>
                                        <v-text-field v-if="this.distribution.length > 1"
                                            hide-details
                                            hide-spin-buttons
                                            class="centered-input" density="compact" type="number" step="0.01"
                                            :disabled="this.distribution[idx].locked"
                                            v-model="this.distribution[idx].percentage"
                                            v-on:keyup.enter="$event.target.blur()"
                                            @blur="validatePercentages(idx)"
                                        ></v-text-field>
                                        <p v-if="this.distribution.length == 1">{{ this.distribution[idx].percentage }}</p>
                                    </td>
                                    <td v-if="this.distribution.length > 2">
                                        <v-icon
                                            :icon="this.distribution[idx].locked ? 'mdi-lock' : 'mdi-lock-open-variant'"
                                            @click="togglePercentageLock(idx)"
                                        ></v-icon>
                                    </td>
                                    <td>
                                        <v-icon @click="delRecipient(recipient.label, recipient.address)">mdi-delete</v-icon>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>
                    </v-form>

                    <v-spacer></v-spacer>
                    <div class="text-center mt-12" v-if="!deleteDistribution && this.distribution.length > 0">
                        Total percentage: {{ totalPercentage }} %
                    </div>

                    <div class="text-center" style="margin-top: 10px;">
                        <v-btn color="primary darken-1" text
                            :disabled="this.distribution.length == 0 && !deleteDistribution"
                            @click=" deleteDistribution ? delDistribution() : addNewDistribution()">
                            {{ deleteDistribution ? 'Delete' : 'Add' }} Distribution
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
        delete: { type: Boolean },
        dLabel: { type: String },
    },
    data() {
        return {
            distributionLabel: '',
            deleteDistribution: false,

            selectedRecipient: null,
            distribution: [],
            recipients: [],
            totalPercentage: 0,
            message: {
                show: false,
                type: 'info',
                text: ''
            }

        }
    },
    validations() {
        return {
            distributionLabel: { required }
        }
    },
    computed: {
        distributionLabelErrors() {
            if (this.v$.distributionLabel.$errors) {
                return this.v$.distributionLabel.$errors.map((err) => { return err.$message })
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
        async delDistribution() {
            let data = {
                deleteLabel: this.distributionLabel
            }
            let response = await this.electronAPI.deleteDistribution(data)
            if (response.status == 200) {
                this.distributionLabel = ''
                this.show = false
            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not add distribution. Second factor authentication failed."
                this.message.show = true
            } else {
                this.message.type = 'error'
                this.message.text = 'Error deleting distribution'
                this.message.show = true
            }
        },
        delRecipient(label, address) {
            this.distribution = this.distribution.filter((curr) => {
                if (curr.address == address && curr.label == label) {
                    this.recipients.push({
                        address: address,
                        label: label
                    })
                    return false
                }
                return true
            })
            let distShare = 100 / this.distribution.length

            this.distribution.forEach((r) => {
                r.percentage = distShare
            })
        },
        async addNewDistribution() {
            let data = {
                // Have to unproxify this.distribution because it's array of proxy objects
                distribution: this.distribution.map(proxyObject => JSON.parse(JSON.stringify(proxyObject))),
                label: this.distributionLabel
            }

            let response = await this.electronAPI.postDistribution(data)
            if (response.status == 200) {
                this.show = false
            } else if (response.status == 403) {
                this.message.type = 'error'
                this.message.text = "Can not add distribution. Second factor authentication failed."
                this.message.show = true
            } else {
                this.message.type = 'error'
                if (response.errors) {
                    this.message.text = data.errors[0]
                } else {
                    this.message.text = 'Couldn\'t create distribution. Either a distribution with that label already exists, or some other unknown error occured.'
                }
                this.message.show = true
            }
        },
        togglePercentageLock(idx) {
            const currentLockedCount = this.distribution.filter(r => r.locked).length
            if (currentLockedCount + 2 < this.distribution.length || this.distribution[idx].locked) {
                this.distribution[idx].locked = !this.distribution[idx].locked
            }
        },
        validatePercentages(updatedIdx) {
            // Calculate the total percentage allocated to locked recipients excluding the updated one if locked
            const totalLockedPercentage = this.distribution.reduce((acc, curr, idx) => acc + ((curr.locked && idx !== updatedIdx) ? curr.percentage : 0), 0)
            
            // Calculate the remaining percentage to be distributed among unlocked recipients
            let remainingPercentage = 100 - totalLockedPercentage
            if (!this.distribution[updatedIdx].locked) {
                remainingPercentage -= this.distribution[updatedIdx].percentage
            }

            const unlockedDistributionIndices = this.distribution
                .map((r, idx) => idx)
                .filter(idx => !this.distribution[idx].locked && idx !== updatedIdx)

            if (unlockedDistributionIndices.length > 0) {
                // Calculate the total percentage of the unlocked recipients
                const totalUnlockedPercentage = unlockedDistributionIndices.reduce((acc, idx) => acc + this.distribution[idx].percentage, 0)

                // Distribute the remaining percentage proportionally
                unlockedDistributionIndices.forEach(idx => {
                    this.distribution[idx].percentage = (this.distribution[idx].percentage / totalUnlockedPercentage) * remainingPercentage
                })

                // Ensure rounding to two decimal places
                this.distribution.forEach(recipient => {
                    recipient.percentage = Math.round(recipient.percentage * 100) / 100
                })

                // If any percentage is below one percent, set it to one and rerun validation
                const belowOnePercent = this.distribution.map((r, idx) => ({...r, idx})).filter(r => r.percentage < 1)
                if (belowOnePercent.length > 0) {
                    belowOnePercent.forEach(r => {
                        this.distribution[r.idx].percentage = 1
                        this.validatePercentages(r.idx)
                    })
                }

                // Correct any rounding errors in the final step
                this.correctRoundingErrors(updatedIdx, unlockedDistributionIndices)
                this.totalPercentage = this.distribution.reduce((total, r) => total + r.percentage, 0)
            }
        },
        correctRoundingErrors(updatedIdx, unlockedDistributionIndices) {
            let currentTotal = this.distribution.reduce((acc, curr) => acc + curr.percentage, 0)
            let roundingError = 100 - currentTotal

            // Apply rounding error correction
            if (roundingError !== 0 && unlockedDistributionIndices.length > 0) {
                // Ideally, find the best candidate(s) for adjustment
                // For simplicity, adjusting the first unlocked, which is not the recently updated one
                let idx = unlockedDistributionIndices[0] === updatedIdx ? unlockedDistributionIndices[1] : unlockedDistributionIndices[0]
                if (idx !== undefined) {
                    this.distribution[idx].percentage += roundingError
                    this.distribution[idx].percentage = Math.round(this.distribution[idx].percentage * 100) / 100
                }
            }
        }
    },
    watch: {
        // whenever question changes, this function will run
        async 'visible'(value) {
            if (value) {
                let data = await this.electronAPI.getRecipients()
                this.recipients = data

                this.editRecipient = false
                this.deleteDistribution = this.delete
                this.distributionLabel = this.dLabel
                if (!this.editRecipient && !this.deleteDistribution) this.distributionLabel = ''
                this.distribution = []
                this.v$.$reset()
            }
        },
        'selectedRecipient'(r) {
            if (this.selectedRecipient != null) {
                // Remove selected
                this.recipients = this.recipients.filter((curr) => {
                    return !(curr.address == r.address && curr.label == r.label)
                })
                // Add selected to table
                this.distribution.push(r)
                // Recalc all percentages to equal shares
                let distShare = Math.floor((100 / this.distribution.length) * 100) / 100

                this.distribution.forEach((r, index) => {
                    r.percentage = distShare
                    r.locked = false
                })

                // Add the remaining percentage to the last recipient
                let totalPercentage = this.distribution.reduce((total, r) => total + r.percentage, 0)
                let remainingPercentage = 100 - totalPercentage
                this.distribution[this.distribution.length - 1].percentage += remainingPercentage

                this.selectedRecipient = null
                this.totalPercentage = totalPercentage + remainingPercentage
            }
        }
    },
    components: {
        Alert
    }
}
</script>

<style scoped>
.centered-input>input {
    text-align: center
}
</style>