<script setup lang="ts">
import CompassGroup from "./components/CompassGroup.vue";
</script>

<template>
   <div class="text-white flex justify-center items-center h-screen">
      <div class="gap-5 py-4 flex items-center justify-center h-screen flex-col">
         <div class="flex flex-col xl:flex-row">
            <CompassGroup url="canthia" />
            <CompassGroup url="snelmannia" />
            <CompassGroup url="tietoteknia" />
         </div>
        <div class="w-screen flex justify-end pr-10">Antell Round coming later...</div>
      </div>
   </div>
</template>

<style scoped></style>
