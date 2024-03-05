<template>
    <div>
        <div class="button-row">
            <v-btn color="primary" @click="distributionDialog.show = true">Add Distribution</v-btn>
        </div>
        
        <v-table>
            <thead class="main-table-head">
                <tr class="main-row">
                    <th class="text-center">
                        Label
                    </th>
                    <th class="text-center">
                        Recipients
                    </th>
                    <th class="text-center">
                        Percentage
                    </th>
                    <th class="text-center">
                        Delete
                    </th>
                </tr>
            </thead>
            <tbody class="main-table-body">
                <tr v-for="(distribution, index) in distributions" :key="index" :style="distributions.length <= 1 ? '' : 'border-bottom: 2px inset rgb(0, 0, 0) !important;'">

                    <td> {{ distribution.label }} </td>
                    <td>
                        <v-table density="compact" style="background: transparent;">
                            <thead></thead>
                        <tbody class="sub-table-body">
                            <tr v-for="(distShare, index) in distribution.distShares" :key="index">
                                <td>{{ distShare.recipient.label }}</td>
                            </tr>
                        </tbody>
                    </v-table>
                    </td>
                    <td>
                        <v-table density="compact" style="background: transparent;">
                            <thead></thead>
                            <tbody class="sub-table-body">
                                <tr v-for="distShare in distribution.distShares" :key="distShare.void">
                                    <td>{{ distShare.percentage }} %</td>
                                </tr>
                            </tbody>
                        </v-table>
                    </td>
                    <td>
                        <v-icon @click="delDistribution(distribution.label)">mdi-delete</v-icon>
                    </td>
                </tr>
            </tbody>
        </v-table>

        <v-row>
            <v-col cols="12">
                <v-expansion-panels>
                    <v-expansion-panel title="Help">
                    <v-expansion-panel-text style="text-align: justify;">
                        A distribution is a group of recipients and their respective shares of your inheritance. You can add a recipient and set their percentage share. You can also delete distributions.

                        You can refer to the distribution when creating your inheritance transaction.
                    </v-expansion-panel-text>
                    </v-expansion-panel>
                </v-expansion-panels>
            </v-col>
        </v-row>

        <DistributionDialog :visible="distributionDialog.show" :delete="distributionDialog.deleteDistribution"
            :dLabel="distributionDialog.dLabel" @close="distributionDialogClose()"></DistributionDialog>
    </div>
</template>
 
<script>
import MenuFrame from './partials/MenuFrame.vue'
import DistributionDialog from './partials/DistributionDialog.vue'
import { ref } from 'vue'

export default {
    name: 'Distribution',
    async mounted() {
        let data = await this.electronAPI.getDistributions()
        this.distributions = data

    },
    data() {
        return {
            distributions: [],
            publicKey: "",
            distributionDialog: {
                show: false,
                deleteDistribution: false,
                dLabel: ""
            }
        }
    },
    methods: {
        delDistribution(label) {
            this.distributionDialog.dLabel = label

            this.distributionDialog.deleteDistribution = true
            this.distributionDialog.show = true
        },
        async distributionDialogClose() {
            this.distributionDialog.show = false
            let data = await this.electronAPI.getDistributions()
            this.distributions = data
            this.distributionDialog.deleteDistribution = false
        }
    },
    components: {
        DistributionDialog,
        MenuFrame
    }
};
</script>
 
<style>
.v-table>.v-table__wrapper>table>tbody>tr>td,
.v-table>.v-table__wrapper>table>tbody>tr>th,
.v-table>.v-table__wrapper>table>thead>tr>td,
.v-table>.v-table__wrapper>table>thead>tr>th,
.v-table>.v-table__wrapper>table>tfoot>tr>td,
.v-table>.v-table__wrapper>table>tfoot>tr>th {
    padding: unset;
}

table {
    border-collapse: collapse;
}
</style>