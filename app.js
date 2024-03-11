require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');

// Enable CORS for all origins
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes from routes.js
const routes = require('./routes');

// Use the routes
app.use('/api', routes);

// Home route for basic API check
app.get('/', (req, res) => {
  res.send('Wingman DB Admin Interface is running');
});

// for the publich files , like index.html
app.use(express.static('public'));

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
