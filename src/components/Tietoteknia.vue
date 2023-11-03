<script setup lang="ts">
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

const data: Menu = {
  RestaurantName: "Tietoteknia",
  RestaurantUrl:
      "https://www.compass-group.fi/ravintolat-ja-ruokalistat/foodco/kaupungit/kuopio/tietoteknia/",
  PriceHeader: null,
  Footer:
      "Huomioithan, ett\u00E4 ravintolassa k\u00E4ytetyt raaka-aineet saattavat vaihtua suunnitellusta ja siten verkkosivuilla julkaistut dieettimerkinn\u00E4t ja tuoteselosteet voivat poiketa todellisesta tarjonnasta. Kehotamme allergisia henkil\u00F6it\u00E4 aina tarkastamaan tarjotun ruuan soveltuvuus omaan ruokavalioon ravintolassa. Kiitos ymm\u00E4rryksest\u00E4nne.  ",
  MenusForDays: [
    {
      Date: "2023-11-03T00:00:00\u002B00:00",
      LunchTime: "10:30\u201314:00",
      SetMenus: [
        {SortOrder: 2, Name: null, Price: null, Components: []},
        {
          SortOrder: 16,
          Name: "P\u00C4IV\u00C4N SOPPA",
          Price: "10,00 \u20AC / opisk.2,95\u20AC \u20AC",
          Components: ["Kurpitsasosekeittoa (*, A, G, ILM, L, M, Veg, VS)"]
        },
        {
          SortOrder: 17,
          Name: "LOUNAS BUFFA",
          Price: "12,00 \u20AC/ opisk. 2,95\u20AC",
          Components: [
            "Kasvisbolognesea (*, A, G, ILM, L, M, Veg, VS)",
            "Luomut\u00E4ysjyv\u00E4spagettia (*, A, ILM, L, M, Veg)"
          ]
        },
        {
          SortOrder: 19,
          Name: "LOUNAS BUFFA",
          Price: "12,00 \u20AC / opisk. 2,95 \u20AC",
          Components: [
            "Tacomaustettuja broilerinuijia (*, G, L, M)",
            "Savupaprikapaahdettuja perunoita (*, G, ILM, L, M, Veg, VS)",
            "Chilimajoneesia (A, G, ILM, L, M, Veg)"
          ]
        },
        {
          SortOrder: 22,
          Name: "LOUNAS BUFFA",
          Price: "12,00\u20AC / opisk.5,60\u20AC",
          Components: [
            "Porsaanleike (A, G, L, M)",
            "Savupaprikapaahdettuja perunoita (*, G, ILM, L, M, Veg, VS)",
            "Bearnaisekastiketta (A, G)"
          ]
        },
        {
          SortOrder: 23,
          Name: "POP UP GRILL",
          Price: "12,00 \u20AC",
          Components: ["Tomaatti-pestopannupizzaa (A, L, VS)"]
        },
        {
          SortOrder: 24,
          Name: "J\u00C4LKK\u00C4RI MAKEAT",
          Price: "opisk. 1,80\u20AC",
          Components: ["Passionhedelm\u00E4-jogurttipannacottaa (A, G, L)"]
        }
      ]
    },
    {Date: "2023-11-04T00:00:00\u002B00:00", LunchTime: null, SetMenus: []},
    {Date: "2023-11-05T00:00:00\u002B00:00", LunchTime: null, SetMenus: []}
  ],
  ErrorText: null
};

function removeParenthesesContent(input: string): string {
  return input.replace(/\(.*?\)/g, '');
}


// get today's menu
const today = new Date().toISOString().slice(0, 10);
const todayMenu = data.MenusForDays.find(
    (menu) => menu.Date.slice(0, 10) === today
);

// get lunch time
const lunchTime = todayMenu?.LunchTime;

// get soup
const soup: SetMenu = todayMenu?.SetMenus[1];

// get lunch buffet
const lunchBuffet: SetMenu = todayMenu?.SetMenus[2];

// get pop up grill
const popUpGrill: SetMenu = todayMenu?.SetMenus[3];

// get dessert
const dessert: SetMenu = todayMenu?.SetMenus[4];
</script>

<template>
  <div>
    <h1 class="text-7xl text-center">Tietoteknia</h1>
    <h2 class="text-2xl text-center">{{ lunchTime }}</h2>

    <table class="m-5">
      <tr>
        <th>Menu</th>
        <th>Components</th>
        <th>Hinta</th>
      </tr>
      <tr v-for="menu in todayMenu.SetMenus">
        <td>{{ menu.Name }}</td>
        <td>{{ menu.Components.map(removeParenthesesContent).join(", ") }}</td>
        <td>{{ menu.Price }}</td>
      </tr>
    </table>
  </div>
</template>

<style scoped></style>
