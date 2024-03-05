import { createApp } from 'vue'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import { createVuetify } from 'vuetify'
import Vuelidate from '@vuelidate/core'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

import App from './App.vue'
import routes from './routes/routes'
import store from './store/store'

const vuetify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi'
    },
    theme: {
        defaultTheme: 'main',
        themes: {
            main: {
                variables: {}, // this property is required to avoid Vuetify crash
                colors: {
                    primary: "#04b1b7",
                    secondary: "#244787",
                    accent: '#607d8b',
                    error: '#f44336',
                    warning: '#ff9800',
                    info: '#8bc34a',
                    success: '#4caf50'
                }
            }
        }
    }
})

const app = createApp(App)
app.config.globalProperties.electronAPI = window.electronAPI
app.use(vuetify)
    .use(routes)
    .use(Vuelidate)
    .use(store)
    .mount('#app').$nextTick(() => {})