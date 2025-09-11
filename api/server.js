import express from 'express';
import {createProxyMiddleware} from 'http-proxy-middleware';
import morgan from 'morgan';
import cors from 'cors';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import apicache from 'apicache';

const app = express();
const cache = apicache.middleware;

// CORS configuration
const corsOptions = {
    origin: [
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

app.use('/tietoteknia', createProxyMiddleware({
    target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0439&language=fi',
    changeOrigin: true,
    pathRewrite: {
        '^/tietoteknia': ''
    },
}));

app.use('/antell', createProxyMiddleware({
    target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=3488&language=fi',
    changeOrigin: true,
    pathRewrite: {
        '^/antell': ''
    },
}));

app.use('/snelmannia', createProxyMiddleware({
    target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0437&language=fi',
    changeOrigin: true,
    pathRewrite: {
        '^/snelmannia': ''
    },
}));

app.use('/canthia', createProxyMiddleware({
    target: 'https://www.compass-group.fi/menuapi/feed/json?costNumber=0436&language=fi',
    changeOrigin: true,
    pathRewrite: {
        '^/canthia': ''
    },
}));

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
                Footer: 'Antell Round. Lounas ma-pe kello 10.00-13.30.',
                MenusForDays: [],
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

        // Get current date in ISO format
        const today = new Date().toISOString().split('T')[0];

        res.json({
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            Footer: 'Antell Round. Lounas ma-pe kello 10.00-13.30. Opiskelijahintainen lounas ainoastaan voimassaolevaa opiskelijakorttia/-sovellusta näyttämällä.',
            MenusForDays: [{
                Date: today,
                LunchTime: '10.00-13.30',
                SetMenus: setMenus
            }],
            ErrorText: null
        });

    } catch (error) {
        console.error('Error fetching Antell menu:', error);
        res.status(500).json({ 
            RestaurantName: 'Antell Round',
            RestaurantUrl: 'https://www.antell.fi/round/',
            PriceHeader: null,
            Footer: 'Antell Round',
            MenusForDays: [],
            ErrorText: 'Failed to fetch menu'
        });
    }
});

app.listen(process.env.PORT || 3000);
