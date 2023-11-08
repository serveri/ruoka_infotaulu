import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";

const app = createApp(App)

// API URL
if (import.meta.env.MODE === 'development') {
    console.log('Running in development mode');
    app.config.globalProperties.API_URL = 'http://localhost:5173'

} else if (import.meta.env.MODE === 'production') {
    console.log('Running in production mode');
    app.config.globalProperties.API_URL = 'https://localhost:3000'
}

app.mount('#app')
