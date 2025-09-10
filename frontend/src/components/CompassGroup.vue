<script setup lang="ts">
import { ref, onMounted } from "vue";

const props = defineProps({
   url: {
      type: String,
      required: true
   }
});

interface Menu {
   RestaurantName: string;
   RestaurantUrl: string;
   PriceHeader: null;
   Footer: string;
   MenusForDays: MenusForDay[];
   ErrorText: null;
}

interface MenusForDay {
   Date: string;
   LunchTime: string | null;
   SetMenus: SetMenu[] | [];
}

interface SetMenu {
   SortOrder: number;
   Name: string | null;
   Price: string | null;
   Components: string[];
}

const data = ref<Menu | null | undefined>(null);
const lunchTime = ref<string | null | undefined>(null);
const date = ref<string | null | undefined>(null);
const todayMenu = ref<MenusForDay | null>(null);

async function fetchData() {
   const response = await fetch(`${props.url}`);
   if (!response.ok) {
      const message = `An error has occurred: ${response.status}`;
      throw new Error(message);
   }
   const data = await response.json();
   return data;
}

onMounted(async () => {
   data.value = await fetchData();
   const today = new Date().toISOString().slice(0, 10);
   const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

   date.value = today;

   let menu = data.value?.MenusForDays.find(
      (menu) => menu.Date.slice(0, 10) === today
   );

   if (!menu) {
      date.value = tomorrow;
      menu = data.value?.MenusForDays.find(
         (menu) => menu.Date.slice(0, 10) === tomorrow
      );
   }

   todayMenu.value = menu || null;
   lunchTime.value = todayMenu.value?.LunchTime;
});
</script>

<script lang="ts">
function removeParenthesesContent(input: string): string {
   return input.replace(/\(.*?\)/g, "").slice(0, -1);
}
function extractPrice(input: string | null) {
   if (input === null) return 0;
   // Match "Opiskelija" price first (most specific)
   const matchOpiskelija = input.match(/Opiskelija\s*(\d+,\d+)\s*€?/);
   if (matchOpiskelija) {
      return matchOpiskelija[1];
   }
   // Fallback to other student price formats (Tietoteknia uses "Opisk.")
   const matchOpisk = input.match(/opisk\.\s*(\d+,\d+)\s*€?/i);
   const matchOp = input.match(/Op\s*(\d+,\d+)\s*€?/);
   if (matchOpisk) {
      return matchOpisk[1];
   } else if (matchOp) {
      return matchOp[1];
   } else {
      return input.slice(0, -1);
   }
}
</script>

<template>
   <section class="w-full rounded-lg">
      <h1 class="text-2xl text-center text-gray-900 dark:text-white pt-4">{{ data?.RestaurantName }}</h1>
      <h2 class="text-lg text-gray-500 dark:text-gray-400 py-2 text-center">
         {{
            `${new Date(date || '').toLocaleDateString("fi-FI", {
               day: "numeric",
               month: "numeric",
               weekday: "long"
            })} ${lunchTime}`
         }}
      </h2>

      <div class="flex justify-center">
         <table class="m-5 border border-gray-300 dark:border-gray-600 w-full max-w-2xl">
            <tr class="text-lg text-left bg-gray-50 dark:bg-gray-700">
               <th class="p-2 text-gray-900 dark:text-white">Menu</th>
               <th class="p-2 text-gray-900 dark:text-white">Raaka-aineet</th>
               <th class="p-2 text-gray-900 dark:text-white">Hinta</th>
            </tr>
            <tr
               class="border-t border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
               v-for="menu in todayMenu?.SetMenus"
            >
               <td v-if="menu?.Name !== null" class="p-2 font-bold text-gray-900 dark:text-white">
                  {{
                     menu.Name.charAt(0).toUpperCase() +
                     menu.Name.toLowerCase().slice(1)
                  }}
               </td>
               <td v-if="menu?.Name !== null" class="p-2 text-gray-700 dark:text-gray-300">
                  {{ menu.Components.map(removeParenthesesContent).join(", ") }}
               </td>
               <td v-if="menu.Name !== null" class="text-sm p-2 text-gray-900 dark:text-white">
                  {{ `${extractPrice(menu.Price)} €` }}
               </td>
            </tr>
         </table>
      </div>
   </section>
</template>
