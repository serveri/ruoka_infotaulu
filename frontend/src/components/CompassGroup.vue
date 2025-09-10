<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Clock } from "lucide-vue-next";

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
      (m: MenusForDay) => m.Date.slice(0, 10) === today
   );

   if (!menu) {
      date.value = tomorrow;
      menu = data.value?.MenusForDays.find(
         (m: MenusForDay) => m.Date.slice(0, 10) === tomorrow
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
   <div class="h-full overflow-hidden shadow-menu dark:shadow-none dark:border md:dark:border-none flex flex-col rounded-lg">
      <!-- Card Header with gradient background -->
      <div class="bg-gradient-fresh text-white p-3 flex-shrink-0">
         <div class="flex items-center justify-between text-xs opacity-90">
            <div class="flex items-center gap-1">
              <h1 class="text-lg font-bold mb-1">{{ data?.RestaurantName }}</h1>
            </div>
            <div class="flex items-center gap-1">
               <Clock class="w-3 h-3" />
               <span>{{ lunchTime || 'Lunch hours' }}</span>
            </div>
         </div>
      </div>

      <!-- Card Content -->
      <div class="p-3 bg-card dark:bg-transparent flex-1 overflow-hidden">
         <div class="space-y-1 h-full overflow-y-auto">
            <!-- Use fallback array to satisfy TS and avoid undefined -->
            <template v-for="menu in (todayMenu?.SetMenus ?? [])" :key="menu.SortOrder">
               <div
                  v-if="menu && menu.Name !== null"
                  class="flex justify-between items-start gap-2 py-1 border-b border-border/20 last:border-b-0"
               >
                  <div class="flex-1 min-w-0">
                     <div class="flex items-start justify-between gap-2">
                        <h4 class="font-semibold text-card-foreground text-xs leading-tight">
                           {{ menu.Name?.charAt(0).toUpperCase() + menu.Name?.toLowerCase().slice(1) }}
                        </h4>
                        <span class="text-sm font-bold text-accent shrink-0">
                           {{ `${extractPrice(menu.Price)} €` }}
                        </span>
                     </div>
                     <p class="text-muted-foreground leading-tight line-clamp-2">
                        {{ menu.Components.map(removeParenthesesContent).join(", ") }}
                     </p>
                  </div>
               </div>
            </template>

            <!-- Empty state -->
            <div v-if="!todayMenu?.SetMenus || todayMenu?.SetMenus.length === 0" class="text-center py-8">
               <p class="text-gray-500 dark:text-gray-400">Ei ruokalistaa saatavilla tälle päivälle</p>
            </div>
         </div>
      </div>
   </div>
</template>
