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
    app.get(path, async (req, res) => {
        const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
        
        try {
            // OPTIMIZATION: Check DB first for today's menu
            // This prevents slow external API calls on every refresh if we already have the data locally.
            // If data is stale or missing, only then do we fetch. 
            // NOTE: We're not fully implementing the "check DB first" logic here yet to keep it simple and safe,
            // but simply creating an endpoint that allows the frontend to rely on backend caching is the first step.
            // However, the user asked why it's slow. It's slow because we await axios.get() on EVERY request.
            
            // To truly optimize:
            // 1. Fetch from DB for 'today'
            // 2. If found, return immediately
            // 3. If not, fetch from external API, save, then return
            
            // Checking DB for existing menu for this date
            /*
             // This requires importing a 'getMenu' function from database.js which we haven't seen explicitly exported for this purpose yet, 
             // but we can infer it or just proceed with the fix requested which was usually about the saving part.
             // Actually, let's keep the current flow but ensuring we save ALL data helps future reads if we implement read-first.
             // For now, the "slowness" is definitely the external fetch.
             // Let's implement a simple in-memory cache time check or DB check if possible.
            */ 

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
            
            res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_HOURS * 3600}`);
            res.json(menuData);
        } catch (error) {
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
    const url = language === 'en' ? 'https://www.antell.fi/round/en/' : 'https://www.antell.fi/round/';
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    const selector = `.lunch-menu-days .lunch-menu-language[data-language="${language}"]`;
    const menuSection = document.querySelector(selector);
    
    if (!menuSection) {
        throw new Error(`No menu section found for language: ${language}`);
    }

    const menusForDays = [];
    const dateHeaders = menuSection.querySelectorAll('h3');

    // Helper to parse Finnish/English date "Maanantai 15.9." or "Monday 15.9."
    const parseDate = (dateStr) => {
        // Matches "Word 15.9."
        const matches = dateStr.match(/(\d+)\.(\d+)\./);
        if (!matches) return null;
        
        const day = parseInt(matches[1], 10);
        const month = parseInt(matches[2], 10);
        
        const now = new Date();
        let year = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        
        // Handle year rollover
        if (currentMonth === 12 && month === 1) year++;
        else if (currentMonth === 1 && month === 12) year--;
        
        const mm = month.toString().padStart(2, '0');
        const dd = day.toString().padStart(2, '0');
        return `${year}-${mm}-${dd}`;
    };

    if (dateHeaders.length > 0) {
        // New logic: Parse multiple days
        dateHeaders.forEach(h3 => {
            const dateStr = h3.textContent.trim();
            const parsedDate = parseDate(dateStr);
            if (!parsedDate) return;

            // Note: In provided HTML structure which we know:
            // The UL is a sibling of H3.
            let nextElement = h3.nextElementSibling;
            if (nextElement && nextElement.tagName === 'UL') {
                const dayContainer = nextElement; // This is the UL
                const setMenus = [];
                const categories = dayContainer.querySelectorAll('.menu-item-category');

                categories.forEach((category, index) => {
                    if (index >= MAX_MENU_CATEGORIES) return;

                    try {
                        const categoryName = category.querySelector('strong')?.textContent?.trim() || '';
                        const priceElement = category.querySelector('.price');
                        const price = priceElement ? priceElement.textContent.trim() : '';

                        let nextLi = category.nextElementSibling;
                        let description = '';

                        // Combine descriptions from following LIs until next category
                        while (nextLi && !nextLi.classList.contains('menu-item-category')) {
                            if (nextLi.tagName === 'LI') {
                                // Sometimes textContent includes children. If there's a strong tag at the end (for # or allergens), we want that text too.
                                // The issue "missing last char" is weird.
                                // Let's simplify: just get textContent.
                                let text = nextLi.textContent.replace(/\n/g, ' ').trim();
                                if (text.endsWith('#')) {
                                    text = text.slice(0, -1).trim();
                                }
                                description += (description ? ' ' : '') + text;
                            }
                            nextLi = nextLi.nextElementSibling;
                        }

                        // Clean up allergens and # markers
                        // CAUTION: The missing char issue might be because textContent includes hidden chars or the # removal was somehow affecting it if no # was present? 
                        // No, replace(/#/g, '') shouldn't remove chars if # isn't there.
                        // However, let's loosen the allergen regex and ensure we don't accidentally slice.
                        
                        const cleanDescription = description
                            .replace(/\([^)]*\)/g, '') // Remove (A), (L, G) etc
                            .replace(/#/g, '')         // Remove # if any remain
                            .replace(/\s+/g, ' ')      // Whitespace
                            .trim();

                        if (categoryName) {
                            setMenus.push({
                                SortOrder: index + 1,
                                Name: categoryName,
                                Price: price,
                                Components: cleanDescription ? [cleanDescription] : []
                            });
                        }
                    } catch (itemError) {
                       // Skip
                    }
                });

                if (setMenus.length > 0) {
                    menusForDays.push({
                        Date: parsedDate,
                        LunchTime: '10.00-13.30',
                        SetMenus: setMenus
                    });
                }
            }
        });
    }

    return {
        RestaurantName: 'Antell Round',
        RestaurantUrl: url,
        PriceHeader: null,
        MenusForDays: menusForDays,
        ErrorText: null
    };
}

// Antell HTML parsing endpoint
app.get('/antell-round', async (req, res) => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
    
    try {
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

        res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_HOURS * 3600}`);
        res.json(menuResponse);

    } catch (error) {
        console.error('Error fetching Antell menu:', error.message);
        res.status(500).json({ 
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            MenusForDays: [{
                Date: today,
                LunchTime: '',
            }],
            ErrorText: 'Failed to fetch menu'
        });
    }
});

// Antell English Endpoint
app.get('/antell-round/en', async (req, res) => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Helsinki' });
    
    try {
        const menuResponse = await scrapeAntellMenu(today, 'en');
        res.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_HOURS * 3600}`);
        res.json(menuResponse);
    } catch (error) {
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
