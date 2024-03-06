require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

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

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
