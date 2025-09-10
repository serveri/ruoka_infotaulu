<script setup lang="ts">
import CompassGroup from "./components/CompassGroup.vue";
import Antell from "./components/Antell.vue";

// Define the API URL - you can also use environment variables here
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const today = new Date();
</script>

<template>
   <div class="bg-gradient-subtle p-4">
      <header class="text-center mb-4">
         <h1 class="text-2xl font-bold text-primary mb-1">
            Kuopio Campus Restaurant Menus
         </h1>
         <p class="text-sm text-muted-foreground">
            {{
               today.toLocaleDateString("fi-FI", {
                  weekday: "long",
                  day: "numeric",
                  month: "numeric"
               })
            }}
            •
            {{
               today.toLocaleDateString("en-US", {
                  weekday: "long",
                  day: "numeric",
                  month: "numeric"
               })
            }}
         </p>
      </header>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
         <CompassGroup :url="`${API_URL}/tietoteknia`" />
         <CompassGroup :url="`${API_URL}/snelmannia`" />
         <CompassGroup :url="`${API_URL}/canthia`" />
         <Antell />
      </div>
      <footer
         class="text-primary w-full flex flex-col justify-center items-center p-4"
      >
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
