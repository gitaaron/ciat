
import { createApp } from 'vue'
import App from './App.vue'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#0088a1',
          secondary: '#ee9b02',
          accent: '#02eecb',
          error: '#843246',
          info: '#5ABCB4',
          success: '#75C18F',
          warning: '#FDBD79',
          background: '#b3ecfb',
          surface: '#e8ebfd',
        },
      },
    },
  },
  defaults: {
    global: {
      fontFamily: 'Poppins, sans-serif',
    },
  },
})

createApp(App).use(vuetify).mount('#app')
