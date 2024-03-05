<template>
    <v-row justify="center">
        <v-dialog v-model="show" persistent max-width="400">
            <v-card>
                <v-card-title class="text-h5">
                    {{ title }}
                </v-card-title>
                <v-card-text>
                    {{ text }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn color="green darken-1 primary" text @click="show = false">
                        {{ buttons.length > 0 ? buttons[0] : "Okay" }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>

<script>
export default {
    props: {
        visible: { type: Boolean },
        title: { type: String },
        text: { type: String },
        buttons: { type: Array },
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
    }
}
</script>