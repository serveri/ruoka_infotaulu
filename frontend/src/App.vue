<script setup lang="ts">
import { ref } from "vue";
import Menu from "./components/Menu.vue";

// Define the API URL - you can also use environment variables here
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const today = new Date();

// Language State
const getInitialLang = (): 'fi' | 'en' => {
   // 1. URL determines state first
   if (window.location.pathname.startsWith('/en')) return 'en';
   // 2. Fallback to stored preference
   const stored = localStorage.getItem('language');
   if (stored === 'en') return 'en';
   return 'fi';
};

const currentLang = ref<'fi' | 'en'>(getInitialLang());

// If we loaded 'en' from storage but are on root URL, update the URL
if (currentLang.value === 'en' && !window.location.pathname.startsWith('/en')) {
   window.history.replaceState({ path: '/en/' }, '', '/en/');
}

const updateUrl = (lang: 'fi' | 'en') => {
   const newPath = lang === 'en' ? '/en/' : '/';
   if (window.location.pathname !== newPath) {
      window.history.pushState({ path: newPath }, '', newPath);
   }
};

const setLanguage = (lang: 'fi' | 'en') => {
   currentLang.value = lang;
   localStorage.setItem('language', lang);
   updateUrl(lang);
};

// Handle back/forward browser buttons
window.addEventListener('popstate', () => {
   currentLang.value = window.location.pathname.startsWith('/en') ? 'en' : 'fi';
});

// Computed URLs
const getUrl = (restaurant: string) => {
   return currentLang.value === 'en' 
      ? `${API_URL}/${restaurant}/en`
      : `${API_URL}/${restaurant}`;
};
</script>

<template>
   <div class="p-4 pb-20 relative min-h-screen">
      <header class="text-center mb-4 xl:hidden">
         <h1 class="text-2xl font-bold text-primary mb-1">
            {{ currentLang === 'fi' ? 'Kuopion Kampuksen Ravintolat' : 'Kuopio Campus Restaurant Menus' }}
         </h1>
         <p class="text-sm text-muted-foreground">
            {{
               today.toLocaleDateString(currentLang === 'fi' ? "fi-FI" : "en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "numeric"
               })
            }}
         </p>
      </header>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
         <Menu :key="currentLang + 'antell'" :url="getUrl('antell-round')" :lang="currentLang" name="Antell Round" />
         <Menu :key="currentLang + 'tietotek'" :url="getUrl('tietoteknia')" :lang="currentLang" name="Tietoteknia" />
         <Menu :key="currentLang + 'snell'" :url="getUrl('snelmannia')" :lang="currentLang" name="Snellmania" />
         <Menu :key="currentLang + 'canthia'" :url="getUrl('canthia')" :lang="currentLang" name="Canthia" />
      </div>
      
      <footer
         class="text-primary w-full flex flex-col justify-center items-center p-4 mb-16 md:mb-0"
      >
         <div class="flex gap-4 mt-2 mb-2">
            <button 
               @click="setLanguage('fi')"
               class="px-3 py-1 rounded transition-colors"
               :class="currentLang === 'fi' ? 'bg-blue-100 dark:bg-blue-900 font-bold' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
               🇫🇮 Suomi
            </button>
            <button 
               @click="setLanguage('en')"
               class="px-3 py-1 rounded transition-colors"
               :class="currentLang === 'en' ? 'bg-blue-100 dark:bg-blue-900 font-bold' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'"
            >
               🇬🇧 English
            </button>
         </div>
         <p class="text-center">
            Developed and Maintained by System Committee @
            <a
               href="https://serveriry.fi?utm_source=ruoka_infotaulu"
               class="underline hover:text-blue-600 dark:hover:text-blue-400"
               >Serveri ry</a
            >
         </p>
         
         <p class="text-center">
            Source code available at
            <a
               class="underline hover:text-blue-600 dark:hover:text-blue-400"
               href="https://github.com/serveri/ruoka_infotaulu"
               >github.com/serveri</a
            >
            under GPL3 license.
         </p>
         
      </footer>
   </div>
</template>

<style scoped></style>
