<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { Clock, AlertCircle } from "lucide-vue-next";

// --- Types ---
interface Menu {
  RestaurantName: string;
  RestaurantUrl: string;
  PriceHeader: null;
  MenusForDays: MenusForDay[];
  ErrorText: null;
}

interface MenusForDay {
  Date: string; // ISO String
  LunchTime: string | null;
  SetMenus: SetMenu[] | [];
}

interface SetMenu {
  SortOrder: number;
  Name: string | null;
  Price: string | null;
  Components: string[];
}

interface DisplayMenuItem extends SetMenu {
  displayName: string;
  displayPrice: string;
  numericPrice: number;
  isLounas: boolean;
  componentString: string;
}

// --- Props ---
const props = defineProps({
  url: {
    type: String,
    required: true,
  },
  lang: {
    type: String,
    default: "fi",
  },
});

// --- State ---
const data = ref<Menu | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);
const currentDayMenu = ref<MenusForDay | null>(null);
const displayDate = ref<string>("");

// --- Helpers (Moved inside setup) ---
const formatPrice = (input: string): string => {
  const num = parseFloat(input.replace(",", "."));
  if (isNaN(num)) return input;
  return num.toFixed(2).replace(".", ",");
};

const extractPrice = (input: string | null): string => {
  if (input === null) return "0";

  // Check for multi-price formats (e.g., "12,70/2,95 €")
  if (input.includes("/")) {
    const parts = input.split("/");
    if (parts.length === 2) {
      const studentPrice = parts[1].replace(/\s*€\s*$/, "").trim();
      const match = studentPrice.match(/(\d+,\d+)/);
      if (match) return formatPrice(match[1]);
    }
  }

  // Regex patterns
  const patterns = [
    /(?:Opiskelija|Student)\s*(\d+,\d+)\s*€?/i,
    /opisk\.\s*(\d+,\d+)\s*€?/i,
    /Op\s*(\d+,\d+)\s*€?/,
    /(\d+,\d+)\s*€?$/   // Simple price at end
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return formatPrice(match[1]);
  }

  return formatPrice(input.replace(/\s*€\s*$/, "").trim());
};

const cleanComponents = (input: string): string => {
  return input
    .replace(/\(.*?\)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
};

const capitalizeName = (name: string | null): string => {
  if (!name) return "";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

// --- Computed ---

// Use Intl.DateTimeFormat for robust, localized day names
const dayShort = computed(() => {
  if (!displayDate.value) return "";
  
  try {
    const date = new Date(displayDate.value);
    return new Intl.DateTimeFormat(props.lang === 'en' ? 'en-GB' : 'fi-FI', { 
      weekday: 'short' 
    }).format(date);
  } catch (e) {
    return "";
  }
});

// Transform data first for cleaner sorting and rendering
const processedMenuItems = computed<DisplayMenuItem[]>(() => {
  if (!currentDayMenu.value?.SetMenus) return [];

  return currentDayMenu.value.SetMenus
    .filter(m => m.Name !== null)
    .map((menu) => {
      const priceStr = extractPrice(menu.Price);
      const nameLower = menu.Name?.toLowerCase() || "";
      
      return {
        ...menu,
        displayName: capitalizeName(menu.Name),
        displayPrice: priceStr,
        numericPrice: parseFloat(priceStr.replace(",", ".")) || 999,
        isLounas: nameLower.includes("lounas") || nameLower.includes("lunch"),
        componentString: menu.Components.map(cleanComponents).join(", ")
      };
    })
    .sort((a, b) => {
      // 1. Prioritize Lounas
      if (a.isLounas && !b.isLounas) return -1;
      if (!a.isLounas && b.isLounas) return 1;

      // 2. Sort by price
      // Lounas items: lowest price first
      // Non-lounas items: highest price first (e.g. A la carte)
      if (a.isLounas && b.isLounas) {
        return a.numericPrice - b.numericPrice;
      }
      return b.numericPrice - a.numericPrice;
    });
});

// --- Lifecycle ---
async function fetchData() {
  try {
    isLoading.value = true;
    error.value = null;
    
    const response = await fetch(props.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    data.value = await response.json();
    
    // Determine which day to show
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    let menu = data.value?.MenusForDays.find(m => m.Date.startsWith(today));

    if (!menu) {
      menu = data.value?.MenusForDays.find(m => m.Date.startsWith(tomorrow));
      if (menu) displayDate.value = tomorrow;
      else displayDate.value = today; // Fallback
    } else {
      displayDate.value = today;
    }

    currentDayMenu.value = menu || null;
    if (menu) displayDate.value = menu.Date;

  } catch (err) {
    console.error(`Failed to load menu from ${props.url}`, err);
    error.value = "Menu unavailable";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="h-full overflow-hidden shadow-menu dark:shadow-none md:dark:border flex flex-col rounded-lg relative">
    
    <!-- Loading/Error Overlay could go here -->
    
    <!-- Card Header -->
    <div class="bg-gradient-fresh text-white p-3 flex-shrink-0">
      <div class="flex items-center justify-between text-xs opacity-90">
        <div class="flex items-center gap-1">
          <h1 class="text-lg font-bold mb-1">
            {{ data?.RestaurantName || "Loading..." }}
          </h1>
        </div>
        <div class="flex items-center gap-1">
          <!-- Show alert icon if error -->
          <AlertCircle v-if="error" class="w-3 h-3 text-red-200" />
          <Clock v-else class="w-3 h-3" />
          
          <span class="text-sm pl-1">{{ dayShort }}</span>
          <span class="text-sm ml-1">{{ currentDayMenu?.LunchTime || "??" }}</span>
        </div>
      </div>
    </div>

    <!-- Card Content -->
    <div class="p-3 bg-card dark:bg-transparent flex-1 overflow-hidden relative">
      <div v-if="error" class="flex items-center justify-center h-full text-red-500">
         <p>{{ error }}</p>
      </div>

      <div v-else class="space-y-1 h-full overflow-y-auto">
        <template v-for="menu in processedMenuItems" :key="menu.SortOrder">
          <div class="flex justify-between items-start gap-2 py-1 border-b border-border/20 last:border-b-0">
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-semibold text-card-foreground text-xs leading-tight">
                  {{ menu.displayName }}
                </h4>
                <span class="text-sm font-bold text-accent shrink-0">
                  {{ menu.displayPrice }} €
                </span>
              </div>
              <p class="text-muted-foreground leading-tight line-clamp-2 text-sm mt-0.5">
                {{ menu.componentString }}
              </p>
            </div>
          </div>
        </template>

        <!-- Empty state -->
        <div v-if="!isLoading && processedMenuItems.length === 0" class="text-center py-8">
          <p class="text-gray-500 dark:text-gray-400">
            Ei ruokalistaa saatavilla tälle päivälle
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
