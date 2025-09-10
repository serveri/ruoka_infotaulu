<script setup lang="ts">
import CompassGroup from "./components/CompassGroup.vue";
import Antell from "./components/Antell.vue";
</script>

<template>
   <div class="text-gray-900 dark:text-white bg-white dark:bg-gray-900 flex justify-center items-center h-min-screen transition-colors">
      <div
         class="gap-5 py-4 flex items-center justify-center h-min-screen flex-col"
      >
         <div class="grid grid-cols-2 gap-5">
            <CompassGroup :url="`${this.API_URL}/tietoteknia`" />
            <CompassGroup :url="`${this.API_URL}/snelmannia`" />
            <CompassGroup :url="`${this.API_URL}/canthia`" />
            <Antell />
         </div>
         <footer class="text-gray-600 dark:text-gray-400">
            <p>Developed and maintained by system committee @ Serveri ry</p>
            <p>
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
   </div>
</template>

<style scoped></style>
