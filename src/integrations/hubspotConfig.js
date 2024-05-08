const axios = require('axios');
require('dotenv').config();

const axiosInstance = axios.create({
    baseURL: process.env.HUBSPOT_BASE_URL || 'https://api.hubapi.com',
    headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_OAUTH_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

module.exports = axiosInstance;
