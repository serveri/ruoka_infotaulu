<script setup lang="ts">
import CompassGroup from "./components/CompassGroup.vue";
import Antell from "./components/Antell.vue";
</script>

<template>
   <div class="text-white flex justify-center items-center h-min-screen">
      <div
         class="gap-5 py-4 flex items-center justify-center h-min-screen flex-col"
      >
         <div class="flex flex-col xl:flex-row">
            <CompassGroup :url="`${this.API_URL}/tietoteknia`" />
            <CompassGroup :url="`${this.API_URL}/snelmannia`" />
            <CompassGroup :url="`${this.API_URL}/canthia`" />
         </div>
         <div class="w-screen flex justify-end pr-10"><Antell /></div>
         <footer>
            <p>Developed and maintained by system committee @ Serveri ry</p>
            <p>
               Source code available at
               <a
                  class="underline"
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
