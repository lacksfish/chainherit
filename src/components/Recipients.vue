<template>
    <div>
        <div class="button-row">
            <v-btn color="primary" @click="recipientDialog.show = true">Add Recipient</v-btn>
        </div>

        <v-table>
            <thead>
                <tr>
                    <th class="text-center">
                        Label
                    </th>
                    <th class="text-center">
                        Address
                    </th>
                    <th class="text-center">
                        Edit | Delete
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="recipient in recipients" :key="recipient.address">
                    <td>{{ recipient.label }}</td>
                    <td> {{ recipient.address }} </td>
                    <td>
                        <v-icon @click="editRecipient(recipient.label, recipient.address)">mdi-square-edit-outline</v-icon>

                        <v-icon @click="delRecipient(recipient.label, recipient.address)">mdi-delete</v-icon>
                    </td>
                </tr>
            </tbody>
        </v-table>

        <v-row>
            <v-col cols="12">
                <v-expansion-panels>
                    <v-expansion-panel title="Help">
                    <v-expansion-panel-text style="text-align: justify;">
                        A recipient is a person or entity that could receive a portion of your inheritance. You can add a label and the address of the recipient. You can also edit or delete the recipient.
                        <br>
                        <br>
                        When creating a distribution, you can refer to the label of the recipient to easily identify who will receive a portion of your inheritance.
                    </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-col>
        </v-row>

        <RecipientDialog :visible="recipientDialog.show" :edit="recipientDialog.editRecipient"
            :delete="recipientDialog.deleteRecipient" :rLabel="recipientDialog.rLabel"
            :rAddress="recipientDialog.rAddress" @close="recipientDialogClose()">
        </RecipientDialog>
    </div>
</template>
 
<script>
import MenuFrame from './partials/MenuFrame.vue'
import RecipientDialog from './partials/RecipientDialog.vue'
import { ref } from 'vue'

export default {
    name: 'Recipients',
    async mounted() {
        let recipients = await this.electronAPI.getRecipients()
        this.recipients = recipients
    },
    data() {
        return {
            recipients: [],

            publicKey: "",
            recipientDialog: {
                show: false,
                editRecipient: false,
                deleteRecipient: false,
                rAddress: "",
                rLabel: ""
            }
        }
    },
    methods: {
        editRecipient(label, address) {
            this.recipientDialog.rLabel = label
            this.recipientDialog.rAddress = address

            this.recipientDialog.editRecipient = true
            this.recipientDialog.show = true
        },
        delRecipient(label, address) {
            this.recipientDialog.rLabel = label
            this.recipientDialog.rAddress = address

            this.recipientDialog.deleteRecipient = true
            this.recipientDialog.show = true
        },
        async recipientDialogClose() {
            this.recipientDialog.show = false
            let data = await this.electronAPI.getRecipients()
            this.recipients = data

            this.recipientDialog.rLabel = ''
            this.recipientDialog.rAddress = ''
            this.recipientDialog.editRecipient = false
            this.recipientDialog.deleteRecipient = false
        }
    },
    components: {
        RecipientDialog,
        MenuFrame
    }
}
</script>
 
<style>
.btn-spacing {
    padding: 1px;
}
</style>