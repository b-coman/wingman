// filename: logger.js

const winston = require('winston');
require('winston').addColors({ yay: 'magenta', debug: 'yellow'}); // Directly add the custom color for 'yay'

// Define custom logging levels and colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    yay: 3, // Adding the 'yay' level
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    yay: 'magenta', // Color for the 'yay' level
    debug: 'yellow'
  },
};

const logger = winston.createLogger({
  level: 'debug', // Set 'yay' as the lowest level to ensure it logs
  levels: customLevels.levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(info => {
      let formattedMessage = info.message;
      if (typeof info.message === 'object') {
        formattedMessage = JSON.stringify(info.message, null, 2);
      }
      return `[${info.timestamp}] ${info.level}: ${formattedMessage}`;
    })
    
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Adjusting console log to colorize the whole line
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }), // Apply color to the entire line
      winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
    ),
  }));
}

module.exports = logger;
