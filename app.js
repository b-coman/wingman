// /app.js

const cors = require('cors');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const generalRouter = require('./src/api/routes');
const logger = require('./logger'); // Import the Winston logger

app.use(cors()); // This will allow all origins. For production, configure allowed origins appropriately.

// Middlewares
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use('/api', generalRouter); // Mount the routes.js

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error stack: %o', err.stack); // Use Winston to log the error stack
    res.status(500).send('Something broke!');
});

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Listen on a port
const PORT = process.env.PORT || 3000; // Use the PORT environment variable or default to 3000
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`); // Use Winston for logging
});
