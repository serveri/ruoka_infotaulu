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
        const today = new Date().toISOString().split('T')[0];
        
        try {
            const response = await axios.get(targetUrl);
            const menuData = response.data;
            
            // Save only today's menu to DB to avoid future-day changes
            const todayMenu = menuData.MenusForDays?.find(day => 
                day.Date?.startsWith(today) && day.SetMenus?.length > 0
            );
            if (todayMenu) {
                try {
                    saveMenu(restaurant, today, menuData);
                } catch (dbError) {
                    console.error(`Failed to save menu for ${restaurant}:`, dbError.message);
                }
            }
            
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

// Helper function to scrape Antell Round menu
async function scrapeAntellMenu(today) {
    const response = await axios.get('https://www.antell.fi/round/');
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    const menuSection = document.querySelector('.lunch-menu-days .lunch-menu-language[data-language="fi"]');
    if (!menuSection) {
        throw new Error('No menu section found');
    }

    const setMenus = [];
    const allCategories = menuSection.querySelectorAll('.menu-item-category');
    const categoriesToProcess = Array.from(allCategories).slice(0, MAX_MENU_CATEGORIES);

    categoriesToProcess.forEach((category, index) => {
        try {
            const categoryName = category.querySelector('strong')?.textContent?.trim() || '';
            const priceElement = category.querySelector('.price');
            const price = priceElement ? priceElement.textContent.trim() : '';

            let nextElement = category.nextElementSibling;
            let description = '';

            while (nextElement && !nextElement.classList.contains('menu-item-category')) {
                if (nextElement.tagName === 'LI') {
                    description = nextElement.textContent.trim();
                    break;
                }
                nextElement = nextElement.nextElementSibling;
            }

            const cleanDescription = description.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

            if (categoryName) {
                setMenus.push({
                    SortOrder: index + 1,
                    Name: categoryName,
                    Price: price,
                    Components: cleanDescription ? [cleanDescription] : []
                });
            }
        } catch (itemError) {
            // Skip invalid items
        }
    });

    return {
        RestaurantName: 'Antell Round',
        RestaurantUrl: 'https://www.antell.fi/round/',
        PriceHeader: null,
        MenusForDays: [{
            Date: today,
            LunchTime: '10.00-13.30',
            SetMenus: setMenus
        }],
        ErrorText: null
    };
}

// Antell HTML parsing endpoint
app.get('/antell-round', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const menuResponse = await scrapeAntellMenu(today);

        // Save to database if there are menu items (Antell currently scrapes today only)
        if (menuResponse.MenusForDays[0].SetMenus.length > 0) {
            try {
                saveMenu('antell-round', today, menuResponse);
            } catch (dbError) {
                console.error(`Failed to save Antell menu:`, dbError.message);
            }
        }

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
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
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
    
    const today = new Date().toISOString().split('T')[0];
    
    for (const restaurant of restaurants) {
        try {
            console.log(`  Fetching ${restaurant.name}...`);
            const response = await axios.get(restaurant.url);
            const menuData = response.data;
            
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
        const menuResponse = await scrapeAntellMenu(today);
        
        if (menuResponse.MenusForDays[0].SetMenus.length > 0) {
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
