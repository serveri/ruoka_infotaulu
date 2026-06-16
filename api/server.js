import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import compression from 'compression';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import cron from 'node-cron';
import db, { saveMenu, getAllMenus, getStats, getMenuItemsByRestaurant } from './database.js';

const app = express();

// Constants
const MAX_MENU_CATEGORIES = 6;
const CACHE_MAX_AGE_HOURS = 1;
const CACHE_TTL_MS = CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
const CACHE_SWR_SECONDS = 10 * 60;
const CACHE_MAX_STALE_MS = 6 * 60 * 60 * 1000;

// In-memory cache for single-instance deployments
const memoryCache = new Map();
const inFlightFetches = new Map();

function setCacheHeaders(res, cacheStatus) {
    res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_HOURS * 3600}, stale-while-revalidate=${CACHE_SWR_SECONDS}`);
    res.set('X-Cache', cacheStatus);
}

async function fetchAndCache(cacheKey, fetcher) {
    if (inFlightFetches.has(cacheKey)) return inFlightFetches.get(cacheKey);

    const promise = (async () => {
        const data = await fetcher();
        memoryCache.set(cacheKey, { data, fetchedAt: Date.now() });
        return data;
    })();

    inFlightFetches.set(cacheKey, promise);
    try {
        return await promise;
    } finally {
        inFlightFetches.delete(cacheKey);
    }
}

async function getCachedResponse(cacheKey, fetcher) {
    const now = Date.now();
    const cached = memoryCache.get(cacheKey);

    if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        return { data: cached.data, cacheStatus: 'HIT' };
    }

    if (cached && (now - cached.fetchedAt) < CACHE_MAX_STALE_MS) {
        if (!inFlightFetches.has(cacheKey)) {
            void fetchAndCache(cacheKey, fetcher).catch(err => {
                console.error(`Cache refresh failed for ${cacheKey}:`, err.message);
            });
        }
        return { data: cached.data, cacheStatus: 'STALE' };
    }

    const data = await fetchAndCache(cacheKey, fetcher);
    return { data, cacheStatus: cached ? 'REFRESH' : 'MISS' };
}

// CORS configuration
app.use(cors({
    origin: [
        'https://lunchmenu.s.serveriry.fi',
        'https://lunch.serveriry.fi',
        'http://localhost:5173',
        'http://localhost:4173'
    ],
    credentials: true
}));

// Middleware
app.use(compression());
app.use(morgan('dev'));

// Helper to create endpoint for Compass Group restaurants
const createCachedEndpoint = (path, restaurant, targetUrl) => {
    const cacheKey = `compass:${path}`;

    app.get(path, async (req, res) => {
        const fetcher = async () => {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
            const response = await axios.get(targetUrl);
            const menuData = response.data;
            
            // Fix restaurant names (remove "Itä-Suomen yliopisto/" prefix)
            // Note: This prefix only appears in the English "University of Eastern Finland/" menus often
            if (menuData.RestaurantName) {
                menuData.RestaurantName = menuData.RestaurantName
                    .replace('Itä-Suomen yliopisto/', '')
                    .replace('University of Eastern Finland/', '');
            }

            // CLEAN PRICES logic
            // Compass group returns "Student 2,95 € / Staff 6,19 € / Guest 6,22 €"
            // We want just "2,95 €" or "2,95" (formatted by frontend)
            // Or if multiple prices, maybe keep them but usually we want Student price.
            if (menuData.MenusForDays) {
                menuData.MenusForDays.forEach(day => {
                    if (day.SetMenus) {
                        day.SetMenus.forEach(menu => {
                            if (menu.Price) {
                                // Regex to find "Student X,XX €" or "Opiskelija X,XX €"
                                // Matches: "Student 2,95" or "Student 2,95 €"
                                // Compass often sends "Student 2,95 € / Staff..."
                                const studentMatch = menu.Price.match(/(?:Student|Opiskelija)\s*(\d+[,.]\d+)/i);
                                if (studentMatch) {
                                    menu.Price = studentMatch[1] + ' €'; // "2,95 €"
                                }
                            }
                        });
                    }
                });
            }

            // Save ALL days to DB, not just today. 
            // This builds up our historical and future data.
            try {
                // Pass null as 3rd arg to save all available days
                saveMenu(restaurant, today, menuData); 
            } catch (dbError) {
                console.error(`Failed to save menu for ${restaurant}:`, dbError.message);
            }

            return menuData;
        };

        try {
            const { data, cacheStatus } = await getCachedResponse(cacheKey, fetcher);
            setCacheHeaders(res, cacheStatus);
            res.json(data);
        } catch (error) {
            const cached = memoryCache.get(cacheKey);
            if (cached?.data) {
                setCacheHeaders(res, 'STALE-ERROR');
                res.json(cached.data);
                return;
            }
            console.error(`Error fetching ${restaurant}:`, error.message);
            res.status(500).json({ error: 'Failed to fetch menu' });
        }
    });
};

createCachedEndpoint('/tietoteknia', 'tietoteknia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi');
createCachedEndpoint('/snelmannia', 'snelmannia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi');
createCachedEndpoint('/canthia', 'canthia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi');

// English Endpoints
createCachedEndpoint('/tietoteknia/en', 'tietoteknia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=en');
createCachedEndpoint('/snelmannia/en', 'snelmannia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=en');
createCachedEndpoint('/canthia/en', 'canthia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=en');

// Helper function to scrape Antell Round menu (Finnish or English)
async function scrapeAntellMenu(today, language = 'fi') {
    // New URL structure
    const url = language === 'en' 
        ? 'https://antell.fi/en/lunch/kuopio/round/' 
        : 'https://antell.fi/lounas/kuopio/round/';
    
    try {
        const response = await axios.get(url);
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        const menusForDays = [];
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        // Scrape lunch opening hours from the page
        // Finnish: .opening-times--lounas, English: .opening-times--lunch
        const hoursSelector = language === 'en' ? '.opening-times--lunch .hours' : '.opening-times--lounas .hours';
        const hoursEl = document.querySelector(hoursSelector);
        const lunchTime = hoursEl ? hoursEl.textContent.trim() : null;

        // Helper to get dates for the current week Monday-Friday
        const getCurrentWeekDate = (dayIndex) => {
            const d = new Date();
            const day = d.getDay(); // 0 (Sun) to 6 (Sat)
            const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(d.setDate(diff));
            
            const targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + dayIndex);
            
            const year = targetDate.getFullYear();
            const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
            const dd = targetDate.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${dd}`;
        };

        days.forEach((dayName, dayIndex) => {
            const panelId = `#panel-${dayName}`;
            const panel = document.querySelector(panelId);

            if (!panel) return;

            // Structure:
            // <section id="panel-Monday">
            //   <div class="tabpanel__specials">
            //     <ul>
            //       <li> (Category)
            //         <div class="option-title"><h5>Category Name</h5> <h5 class="option-price">Price</h5></div>
            //         <ul class="accordion__list">
            //           <li> (Dish)
            //             <div class="accordion">
            //               <button class="accordion__button">Dish Name</button>
            //               ... <div class="accordion__footer__special-diets"><p>Diets</p></div>
            //             </div>
            //           </li>
            //         </ul>
            //       </li>
            //     </ul>
            //   </div>
            // </section>

            // Select all direct LI children of the UL inside .tabpanel__specials
            // Note: The structure might vary slightly, but generally .tabpanel__specials > ul > li seems correct for categories
            const categoryItems = panel.querySelectorAll('.tabpanel__specials > ul > li');
            const setMenus = [];

            categoryItems.forEach((catItem, catOrder) => {
                // Category Name
                const titleEl = catItem.querySelector('.option-title h5');
                const priceEl = catItem.querySelector('.option-price');
                
                let categoryName = titleEl ? titleEl.textContent.trim() : '';
                let priceRaw = priceEl ? priceEl.textContent.trim() : '';
                
                // Clean price: "12,50/3,10 €" -> "2,95 €" logic? 
                // Usually take the student price if available or just keep as is.
                // Compass logic was taking "Student X €". Here we have "12,50/3,10 €".
                // 12.50 is normal, 3.10 is Kela/student.
                let price = priceRaw;

                // Dishes are inside .accordion__list > li
                const dishItems = catItem.querySelectorAll('.accordion__list > li');
                const components = [];

                dishItems.forEach(dishItem => {
                    const button = dishItem.querySelector('.accordion__button');
                    const dietP = dishItem.querySelector('.accordion__footer__special-diets p');
                    
                    if (button) {
                        let dishName = button.textContent.replace(/\s+/g, ' ').trim();
                        let diets = dietP ? dietP.textContent.trim() : '';
                        
                        // Combine Name + Diets
                        const fullDish = diets ? `${dishName} (${diets})` : dishName;
                        components.push(fullDish);
                    }
                });

                if (components.length > 0) {
                    setMenus.push({
                        SortOrder: catOrder + 1,
                        Name: categoryName || `Menu ${catOrder + 1}`,
                        Price: price,
                        Components: components
                    });
                }
            });

            if (setMenus.length > 0) {
                menusForDays.push({
                    Date: getCurrentWeekDate(dayIndex),
                    LunchTime: lunchTime, // Scraped from the Antell website
                    SetMenus: setMenus
                });
            }
        });

        return {
            RestaurantName: 'Antell Round',
            RestaurantUrl: url,
            PriceHeader: null,
            MenusForDays: menusForDays,
            ErrorText: null
        };

    } catch (e) {
        console.error('Antell scraper error:', e);
        throw e;
    }
}

// Antell HTML parsing endpoint
app.get('/antell-round', async (req, res) => {
    const cacheKey = 'antell:fi';

    const fetcher = async () => {
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
        const menuResponse = await scrapeAntellMenu(today, 'fi');

        // Save ALL parsed menus to database
        if (menuResponse.MenusForDays.length > 0) {
            try {
                // Pass null to save all days
                saveMenu('antell-round', today, menuResponse);
            } catch (dbError) {
                console.error(`Failed to save Antell menu:`, dbError.message);
            }
        }

        return menuResponse;
    };
    
    try {
        const { data, cacheStatus } = await getCachedResponse(cacheKey, fetcher);
        setCacheHeaders(res, cacheStatus);
        res.json(data);
    } catch (error) {
        const cached = memoryCache.get(cacheKey);
        if (cached?.data) {
            setCacheHeaders(res, 'STALE-ERROR');
            res.json(cached.data);
            return;
        }
        console.error('Error fetching Antell menu:', error.message);
        res.status(500).json({ 
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            MenusForDays: [{
                Date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' }),
                LunchTime: '',
            }],
            ErrorText: 'Failed to fetch menu'
        });
    }
});

// Antell English Endpoint
app.get('/antell-round/en', async (req, res) => {
    const cacheKey = 'antell:en';

    const fetcher = async () => {
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
        return await scrapeAntellMenu(today, 'en');
    };
    
    try {
        const { data, cacheStatus } = await getCachedResponse(cacheKey, fetcher);
        setCacheHeaders(res, cacheStatus);
        res.json(data);
    } catch (error) {
        const cached = memoryCache.get(cacheKey);
        if (cached?.data) {
            setCacheHeaders(res, 'STALE-ERROR');
            res.json(cached.data);
            return;
        }
        console.error('Error fetching Antell EN menu:', error.message);
        res.status(500).json({ error: 'Failed to fetch English menu' });
    }
});

// Trigger endpoint for manual/cron refresh
app.post('/api/refresh-menus', async (req, res) => {
    console.log('🔄 Manual refresh triggered');
    try {
        await fetchAllRestaurants();
        res.json({ success: true, message: 'Menus refreshed successfully' });
    } catch (error) {
        console.error('❌ Refresh failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check endpoint for Coolify
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Analytics endpoints
app.get('/analytics/all', (req, res) => {
    const menus = getAllMenus();
    res.json(menus);
});

// Removed /analytics/dishes (duplicate of /analytics/all). Use /analytics/all with query params in future if needed.

app.get('/analytics/stats', (req, res) => {
    const stats = getStats();
    res.json(stats);
});

// Debug endpoint to check table schema
app.get('/analytics/schema/:restaurant', (req, res) => {
    const { restaurant } = req.params;
    const tableName = `${restaurant.replace(/-/g, '_')}_menus`;
    
    try {
        const schema = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const sampleData = db.prepare(`SELECT * FROM ${tableName} LIMIT 3`).all();
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
        res.json({ tableName, schema, count, sampleData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Simple debug endpoint to check all table counts
app.get('/analytics/debug/counts', (req, res) => {
    try {
        const counts = {
            tietoteknia: db.prepare(`SELECT COUNT(*) as count FROM tietoteknia_menus`).get(),
            snelmannia: db.prepare(`SELECT COUNT(*) as count FROM snelmannia_menus`).get(),
            canthia: db.prepare(`SELECT COUNT(*) as count FROM canthia_menus`).get(),
            antell_round: db.prepare(`SELECT COUNT(*) as count FROM antell_round_menus`).get()
        };
        res.json(counts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear today's data for a specific restaurant to force refresh
// Removed insecure deletion endpoint /analytics/clear/:restaurant

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Analytics: http://localhost:${PORT}/analytics/all`);
    
    // Auto-fetch all restaurant menus on startup
    setTimeout(() => {
        console.log('🔄 Auto-fetching menus for all restaurants...');
        fetchAllRestaurants();
    }, 2000); // Wait 2 seconds after startup
    
    // Schedule daily fetch at 11:00 AM
    cron.schedule('0 11 * * *', () => {
        console.log('Daily cron job (11:00 AM): Fetching menus...');
        fetchAllRestaurants();
    });
    
    // Schedule daily fetch at 12:00 PM (noon)
    cron.schedule('0 12 * * *', () => {
        console.log('Daily cron job (12:00 PM): Fetching menus...');
        fetchAllRestaurants();
    });
    
    console.log('Cron jobs scheduled: Daily fetch at 11:00 AM and 12:00 PM');
});

// Function to fetch and cache all restaurant menus
async function fetchAllRestaurants() {
    const restaurants = [
        { name: 'tietoteknia', url: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi' },
        { name: 'snelmannia', url: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi' },
        { name: 'canthia', url: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi' }
    ];
    
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
    
    for (const restaurant of restaurants) {
        try {
            console.log(`  Fetching ${restaurant.name}...`);
            const response = await axios.get(restaurant.url);
            const menuData = response.data;
            
            // Fix restaurant names (remove "Itä-Suomen yliopisto/" prefix)
            if (menuData.RestaurantName && menuData.RestaurantName.includes('Itä-Suomen yliopisto/')) {
                menuData.RestaurantName = menuData.RestaurantName.replace('Itä-Suomen yliopisto/', '');
            }
            
            const todayMenu = menuData.MenusForDays?.find(day => 
                day.Date?.startsWith(today) && day.SetMenus?.length > 0
            );
            if (todayMenu) {
                saveMenu(restaurant.name, today, menuData);
                console.log(`  ✅ ${restaurant.name} saved`);
            } else {
                console.log(`  ❎ ${restaurant.name} has no menu for today`);
            }
        } catch (error) {
            console.error(`  ❌ Failed to fetch ${restaurant.name}:`, error.message);
        }
    }
    
    // Fetch Antell Round separately (requires scraping)
    try {
        console.log(`  Fetching antell-round...`);
        // We only save the Finnish version in the background job for now
        const menuResponse = await scrapeAntellMenu(today, 'fi');
        
        if (menuResponse.MenusForDays && menuResponse.MenusForDays.length > 0) {
            saveMenu('antell-round', today, menuResponse);
            console.log(`  ✅ antell-round saved`);
        } else {
            console.log(`  ❎ antell-round has no menu items`);
        }
    } catch (error) {
        console.error(`  ❌ Failed to fetch antell-round:`, error.message);
    }
    
    console.log('✅ Auto-fetch complete!');
}
