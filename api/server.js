import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import apicache from 'apicache';

const app = express();
const cache = apicache.middleware;

// CORS configuration
const corsOptions = {
    origins: [
        'https://lunchmenu.s.serveriry.fi',
        'https://lunch.serveriry.fi',
        'http://localhost:5173',
        'http://localhost:4173'
    ],
    credentials: true
};

app.use(cors(corsOptions));

// use morgan middleware for logging
app.use(morgan('dev'));

const cacheTime = '1 hour'
app.use(cache(cacheTime));

// Custom endpoint for Tietoteknia with sorting
app.get('/tietoteknia', async (req, res) => {
    try {
        const response = await axios.get('https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi');
        const data = response.data;
        
        // Sort menu items in each day
        if (data.MenusForDays) {
            data.MenusForDays.forEach(day => {
                if (day.SetMenus) {
                    day.SetMenus.sort((a, b) => {
                        const aHasLounas = a.Name?.toLowerCase().includes('lounas') || false;
                        const bHasLounas = b.Name?.toLowerCase().includes('lounas') || false;
                        
                        if (aHasLounas === bHasLounas) {
                            return a.SortOrder - b.SortOrder;
                        }
                        
                        return bHasLounas ? 1 : -1;
                    });
                    
                    // Update SortOrder after sorting
                    day.SetMenus.forEach((item, index) => {
                        item.SortOrder = index + 1;
                    });
                }
            });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching Tietoteknia menu:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// Custom endpoint for Snelmannia with sorting
app.get('/snelmannia', async (req, res) => {
    try {
        const response = await axios.get('https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi');
        const data = response.data;
        
        // Sort menu items in each day
        if (data.MenusForDays) {
            data.MenusForDays.forEach(day => {
                if (day.SetMenus) {
                    day.SetMenus.sort((a, b) => {
                        const aHasLounas = a.Name?.toLowerCase().includes('lounas') || false;
                        const bHasLounas = b.Name?.toLowerCase().includes('lounas') || false;
                        
                        if (aHasLounas === bHasLounas) {
                            return a.SortOrder - b.SortOrder;
                        }
                        
                        return bHasLounas ? 1 : -1;
                    });
                    
                    // Update SortOrder after sorting
                    day.SetMenus.forEach((item, index) => {
                        item.SortOrder = index + 1;
                    });
                }
            });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching Snelmannia menu:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// Custom endpoint for Canthia with sorting
app.get('/canthia', async (req, res) => {
    try {
        const response = await axios.get('https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi');
        const data = response.data;
        
        // Sort menu items in each day
        if (data.MenusForDays) {
            data.MenusForDays.forEach(day => {
                if (day.SetMenus) {
                    day.SetMenus.sort((a, b) => {
                        const aHasLounas = a.Name?.toLowerCase().includes('lounas') || false;
                        const bHasLounas = b.Name?.toLowerCase().includes('lounas') || false;
                        
                        if (aHasLounas === bHasLounas) {
                            return a.SortOrder - b.SortOrder;
                        }
                        
                        return bHasLounas ? 1 : -1;
                    });
                    
                    // Update SortOrder after sorting
                    day.SetMenus.forEach((item, index) => {
                        item.SortOrder = index + 1;
                    });
                }
            });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching Canthia menu:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
});

// Antell HTML parsing endpoint
app.get('/antell-round', async (req, res) => {
    try {
        const response = await axios.get('https://www.antell.fi/round/');
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Find the lunch menu section
        const menuSection = document.querySelector('.lunch-menu-days .lunch-menu-language[data-language="fi"]');
        
        if (!menuSection) {
            return res.json({ 
                RestaurantName: 'Antell Round',
                RestaurantUrl: 'https://www.antell.fi/round/',
                PriceHeader: null,
                MenusForDays: [{
                    Date: new Date().toISOString().split('T')[0],
                    LunchTime: '',
                    SetMenus: []
                }],
                ErrorText: 'Menu not found'
            });
        }

        // Extract menu items
        const setMenus = [];
        const categories = menuSection.querySelectorAll('.menu-item-category');
        
        categories.forEach((category, index) => {
            const categoryName = category.querySelector('strong').textContent.trim();
            const priceElement = category.querySelector('.price');
            const price = priceElement ? priceElement.textContent.trim() : '';
            
            // Find the description (next li element that's not a category)
            let nextElement = category.nextElementSibling;
            let description = '';
            
            while (nextElement && !nextElement.classList.contains('menu-item-category')) {
                if (nextElement.tagName === 'LI') {
                    description = nextElement.textContent.trim();
                    break;
                }
                nextElement = nextElement.nextElementSibling;
            }

            // Clean up description - remove allergen info and extra text
            const cleanDescription = description.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

            setMenus.push({
                SortOrder: index + 1,
                Name: categoryName,
                Price: price,
                Components: cleanDescription ? [cleanDescription] : []
            });
        });

        // Sort menu items to put "lounas" items at the top
        setMenus.sort((a, b) => {
            const aHasLounas = a.Name?.toLowerCase().includes('lounas') || false;
            const bHasLounas = b.Name?.toLowerCase().includes('lounas') || false;
            
            // If both or neither have "lounas", maintain original order
            if (aHasLounas === bHasLounas) {
                return a.SortOrder - b.SortOrder;
            }
            
            // Put "lounas" items first
            return bHasLounas ? 1 : -1;
        });

        // Update SortOrder after sorting
        setMenus.forEach((item, index) => {
            item.SortOrder = index + 1;
        });

        // Get current date in ISO format
        const today = new Date().toISOString().split('T')[0];

        res.json({
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            MenusForDays: [{
                Date: today,
                LunchTime: '10.00-13.30',
                SetMenus: setMenus
            }],
            ErrorText: null
        });

    } catch (error) {
        console.error('Error fetching Antell menu:', error);
        res.status(200).json({ 
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            MenusForDays: [{
                Date: new Date().toISOString().split('T')[0],
                LunchTime: '',
            }],
            ErrorText: 'Failed to fetch menu'
        });
    }
});

app.listen(process.env.PORT || 3000);
