import express from 'express';
import {createProxyMiddleware} from 'http-proxy-middleware';
import morgan from 'morgan';

const app = express();

// use morgan middleware for logging
app.use(morgan('dev'));

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

app.listen(process.env.PORT || 3000);
