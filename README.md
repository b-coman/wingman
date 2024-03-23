# Wingman App

The Wingman app is a comprehensive solution designed to streamline engagement processes, automate assessments, and enhance user interaction through AI-driven analysis. The backend is built on Express.js and integrates with Airtable for data management and external AI services for advanced data processing.

## Tech Stack

- **Node.js**: JavaScript runtime for building the server-side application.
- **Express.js**: Web application framework for Node.js, designed for building web applications and APIs.
- **Airtable**: Cloud-based database service for storing and retrieving application data.
- **Azure Web Services**: Cloud computing service for hosting and managing the application.
- **Typeform API**: Integrated for managing surveys and collecting responses.
- **Flask (Python)**: Used in the `wingman-agents` application for AI-driven data processing.
- **Winston**: A logging library for Node.js.
- **Nodemailer**: Module for sending emails directly from the application.

## Dependencies

- **express**: Fast, unopinionated, minimalist web framework for Node.js.
- **cors**: Middleware to enable CORS with various options.
- **body-parser**: Node.js body parsing middleware.
- **dotenv**: Module that loads environment variables from a `.env` file into `process.env`.
- **axios**: Promise based HTTP client for the browser and Node.js.
- **Airtable**: Accessible database and API from simple spreadsheets.
- **marked**: A markdown parser and compiler. Built for speed.
- **winston**: A logger for just about everything.
- **nodemailer**: Easy as cake e-mail sending from your Node.js applications.
- **ajv**: Another JSON Schema Validator.

Please make sure to run `npm install` to install these dependencies before starting the application.


## Installation

Clone this repository and install dependencies:

git clone https://github.com/b-coman/wingman.git
cd wingman
npm install

## Getting Started

To get the application running, set up your environment variables according to the .env.example file and then start the server:

npm start
Visit http://localhost:3000 to view the application.

## License

This project is licensed under the MIT License - see the LICENSE file for details.