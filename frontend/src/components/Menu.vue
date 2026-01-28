<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
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

// Computed property to sort menu items - lounas items first, then by price
const sortedMenuItems = computed(() => {
   if (!todayMenu.value?.SetMenus) return [];

   return [...todayMenu.value.SetMenus].sort((a, b) => {
      const aIsLounas = a.Name?.toLowerCase().includes("lounas") || false;
      const bIsLounas = b.Name?.toLowerCase().includes("lounas") || false;

      // If one is lounas and the other isn't, prioritize lounas
      if (aIsLounas && !bIsLounas) return -1;
      if (!aIsLounas && bIsLounas) return 1;

      // Sort by price based on whether items are lounas or not
      const aPriceStr = extractPrice(a.Price);
      const bPriceStr = extractPrice(b.Price);

      const aPrice = parseFloat(String(aPriceStr).replace(",", ".")) || 999;
      const bPrice = parseFloat(String(bPriceStr).replace(",", ".")) || 999;

      // Lounas items: lowest price first, Non-lounas items: highest price first
      if (aIsLounas && bIsLounas) {
         return aPrice - bPrice; // Lowest first for lounas
      } else {
         return bPrice - aPrice; // Highest first for non-lounas
      }
   });
});

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
   if (todayMenu.value) {
      date.value = todayMenu.value.Date;
   }
   lunchTime.value = todayMenu.value?.LunchTime;
});
</script>

<script lang="ts">
function removeParenthesesContent(input: string): string {
   return input.replace(/\(.*?\)/g, "").slice(0, -1);
}
function extractPrice(input: string | null) {
   if (input === null) return 0;

   // Handle Antell format first (e.g., "12,70/2,95 €")
   if (input.includes("/")) {
      const parts = input.split("/");
      if (parts.length === 2) {
         // Extract the student price (after slash) and remove € symbol
         const studentPrice = parts[1].replace(/\s*€\s*$/, "").trim();
         const match = studentPrice.match(/(\d+,\d+)/);
         if (match) {
            return match[1];
         }
      }
   }

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

function getDayShortFromDate(dateString: string | null | undefined): string {
   if (!dateString) return "";

   const days = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];
   const date = new Date(dateString);
   return days[date.getDay()];
}
</script>

<template>
   <div
      class="h-full overflow-hidden shadow-menu dark:shadow-none md:dark:border flex flex-col rounded-lg"
   >
      <!-- Card Header with gradient background -->
      <div class="bg-gradient-fresh text-white p-3 flex-shrink-0">
         <div class="flex items-center justify-between text-xs opacity-90">
            <div class="flex items-center gap-1">
               <h1 class="text-lg font-bold mb-1">
                  {{ data?.RestaurantName }}
               </h1>
            </div>
            <div class="flex items-center gap-1">
               <Clock class="w-3 h-3" />
               <span class="text-sm pl-1">{{
                  getDayShortFromDate(date)
               }}</span>
               <span class="text-sm">{{ lunchTime || "??" }}</span>
            </div>
         </div>
      </div>

      <!-- Card Content -->
      <div class="p-3 bg-card dark:bg-transparent flex-1 overflow-hidden">
         <div class="space-y-1 h-full overflow-y-auto">
            <!-- Use sorted menu items -->
            <template v-for="menu in sortedMenuItems" :key="menu.SortOrder">
               <div
                  v-if="menu && menu.Name !== null"
                  class="flex justify-between items-start gap-2 py-1 border-b border-border/20 last:border-b-0"
               >
                  <div class="flex-1 min-w-0">
                     <div class="flex items-start justify-between gap-2">
                        <h4
                           class="font-semibold text-card-foreground text-xs leading-tight"
                        >
                           {{
                              menu.Name?.charAt(0).toUpperCase() +
                              menu.Name?.toLowerCase().slice(1)
                           }}
                        </h4>
                        <span class="text-sm font-bold text-accent shrink-0">
                           {{ `${extractPrice(menu.Price)} €` }}
                        </span>
                     </div>
                     <p
                        class="text-muted-foreground leading-tight line-clamp-2, text-sm mt-0.5"
                     >
                        {{
                           menu.Components.map(removeParenthesesContent).join(
                              ", "
                           )
                        }}
                     </p>
                  </div>
               </div>
            </template>

            <!-- Empty state -->
            <div v-if="sortedMenuItems.length === 0" class="text-center py-8">
               <p class="text-gray-500 dark:text-gray-400">
                  Ei ruokalistaa saatavilla tälle päivälle
               </p>
            </div>
         </div>
      </div>
   </div>
</template>
