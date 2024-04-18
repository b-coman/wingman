// file: src/services/validationService.js

const fs = require('fs').promises;
const Ajv = require('ajv');
const path = require('path');
const logger = require('../../logger'); // Adjust the path as needed to import your Winston logger

const ajv = new Ajv({ allErrors: true });
const schemaCache = {};

async function loadSchema(schemaRelativePath) {
    const fullPath = path.resolve(__dirname, schemaRelativePath); // Construct an absolute path
    if (schemaCache[fullPath]) {
        return schemaCache[fullPath];
    }

    try {
        const data = await fs.readFile(fullPath, 'utf8');
        const schema = JSON.parse(data);
        schemaCache[fullPath] = schema; // Cache the schema for future use
        logger.info(`Schema loaded and cached for ${fullPath}`);
        return schema;
    } catch (error) {
        logger.error(`Failed to load schema from ${fullPath}: ${error.message}`);
        throw error; // Rethrow to handle it further up the call stack
    }
}

async function validateJson(jsonData, schemaRelativePath) {
    try {
        const schema = await loadSchema(schemaRelativePath);
        const validate = ajv.compile(schema);
        const valid = validate(jsonData);
        if (!valid) {
            logger.error(`Validation errors: ${JSON.stringify(validate.errors)}`);
            return { valid: false, errors: validate.errors };
        }
        logger.yay('JSON is valid.');
        return { valid: true, errors: null };
    } catch (error) {
        logger.error(`Error during JSON validation: ${error.message}`);
        return { valid: false, errors: [error.message] };
    }
}

module.exports = { validateJson };
