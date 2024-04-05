// /src/lib/validateConfig.js

const Ajv = require("ajv");
const ajv = new Ajv();
const fs = require("fs");
const path = require("/schemas");

// Load the schema from a file
const schemaPath = path.join(__dirname, '..', 'schemas', 'crewConfigurationSchema.json');
const crewSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const validateCrewConfig = ajv.compile(crewSchema);

module.exports = {
  validateConfiguration: (config) => validateCrewConfig(config),
  getValidationErrors: () => validateCrewConfig.errors,
};
