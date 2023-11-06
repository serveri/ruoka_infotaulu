<script setup lang="ts">
import CompassGroup from "./components/CompassGroup.vue";
</script>

<template>
   <div class="text-white flex justify-center items-center h-min-screen">
      <div class="gap-5 py-4">
         <div class="flex">
           <CompassGroup url="canthia" />
           <CompassGroup url="snelmannia" />
           <CompassGroup url="tietoteknia" />
         </div>
        <div class="flex justify-center items-center">
         </div>
      </div>
   </div>
</template>

<style scoped></style>
