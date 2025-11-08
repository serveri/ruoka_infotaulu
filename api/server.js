import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import compression from 'compression';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { saveMenu, getMenu, getAllMenus, getStats } from './database.js';

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

// Helper to create a caching endpoint
const createCachedEndpoint = (path, restaurant, targetUrl) => {
    app.get(path, async (req, res) => {
        const today = new Date().toISOString().split('T')[0];
        
        const cached = getMenu(restaurant, today);
        if (cached && !cached.isStale) {
            return res.json(cached.data);
        }
        
        try {
            const response = await axios.get(targetUrl);
            const menuData = response.data;
            
            // Only save if there's actual menu data for today
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
            if (cached) {
                return res.json(cached.data);
            }
            res.status(500).json({ error: 'Failed to fetch menu' });
        }
    });
};

createCachedEndpoint('/tietoteknia', 'tietoteknia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi');
createCachedEndpoint('/snelmannia', 'snelmannia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi');
createCachedEndpoint('/canthia', 'canthia', 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi');

// Antell HTML parsing endpoint
app.get('/antell-round', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Try database cache first
    const cached = getMenu('antell-round', today);
    if (cached && !cached.isStale) {
        return res.json(cached.data);
    }
    
    try {
        const response = await axios.get('https://www.antell.fi/round/');
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        const menuSection = document.querySelector('.lunch-menu-days .lunch-menu-language[data-language="fi"]');
        
        if (!menuSection) {
            return res.status(500).json({ 
                RestaurantName: 'Antell Round',
                RestaurantUrl: 'https://www.antell.fi/round/',
                PriceHeader: null,
                MenusForDays: [{
                    Date: today,
                    LunchTime: '',
                    SetMenus: []
                }],
                ErrorText: 'Menu not found'
            });
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

        const menuResponse = {
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

        // Only save to database if there are menu items
        if (setMenus.length > 0) {
            try {
                saveMenu('antell-round', today, menuResponse);
            } catch (dbError) {
                console.error(`Failed to save Antell menu:`, dbError.message);
            }
        }

        res.json(menuResponse);

    } catch (error) {
        console.error('Error fetching Antell menu:', error.message);
        // Try to serve stale cache if available
        if (cached) {
            return res.json({ ...cached.data, ErrorText: 'Served from cache (fetch failed)' });
        }
        
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

// Analytics endpoints
app.get('/analytics/all', (req, res) => {
    const menus = getAllMenus();
    res.json(menus);
});

app.get('/analytics/stats', (req, res) => {
    const stats = getStats();
    res.json(stats);
});

app.listen(process.env.PORT || 3000);
