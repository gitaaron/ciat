
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
          primary: '#843246',      // Dark burgundy - main brand color
          secondary: '#FD7646',    // Orange - secondary actions
          accent: '#5ABCB4',       // Teal - accent elements
          error: '#843246',        // Dark burgundy for errors (maintains consistency)
          info: '#5ABCB4',         // Teal for info
          success: '#75C18F',      // Mint green for success
          warning: '#FDBD79',      // Light peach for warnings
          background: '#FDBD79',   // Light peach background
          surface: '#FDBD79',      // Light peach surface
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
