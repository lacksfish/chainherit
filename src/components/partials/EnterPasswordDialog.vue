<template>
    <v-row justify="center">
        <v-dialog v-model="show" persistent max-width="30%">
            <Alert v-model="message.show" :type="message.type" :text="message.text"></Alert>
            <v-card>
                <v-card-title class="text-h5">
                    Enter Password
                </v-card-title>
                <v-card-text>
                    <v-row justify="center">
                        Enter your password.
                    </v-row>

                    <v-row justify="center">
                        <v-text-field class="password centered-input" name="password" type="password" label="Password"
                            v-model="password"
                            @keyup.enter="!(!!this.password && (this.password.length == 0)) ? postPassword() : null">
                        </v-text-field>
                    </v-row>

                    <div class="text-center" style="margin-top: 10px;">
                        <v-btn color="primary darken-1" text :disabled="this.password.length == 0"
                            v-on:click="postPassword()">
                            Submit
                        </v-btn>
                    </div>

                </v-card-text>
                <v-card-actions v-if="closeable">
                    <v-spacer></v-spacer>
                    <v-btn color="green darken-1 primary" text @click="show = false">
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-row>
</template>

<script>
import { sha512 } from '../../utils'
import Alert from './Alert.vue'

export default {
    props: {
        visible: { type: Boolean },
        value: { type: String },
        closeable: { type: Boolean, default: true }
    },
    emits: ["close"],
    data() {
        return {
            password: '',
            message: {
                show: false,
                type: 'info',
                text: ''
            }
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
        async postPassword() {
            let res = await this.electronAPI.postPassword(sha512(this.password))
            this.password = ''
            if (res.status != 200) {
                this.message.text = "Invalid password"
                this.message.type = 'error'
                this.message.show = true
            } else {
                this.show = false
            }
        }
    },
    watch: {
        'visible'(value) {
            if (value) {
                this.password = ''
            }
        }
    },
    components: {
        Alert
    }
}
</script>

<style>
.password {
    min-width: 32px;
    max-width: 22rem;
}

.centered-input input {
    text-align: center;
}
</style>