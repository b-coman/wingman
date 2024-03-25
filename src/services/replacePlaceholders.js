// Filename: /src/services/replacePlaceholders.js


const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const logger = require('../../logger'); 

/**
 * Generates content by replacing placeholders in a Handlebars template. 
 * It can accept either a path to a template file or a template string.
 * 
 * @param {String} templateInput - The path to the template file or the template string itself.
 * @param {Object} replacements - An object containing placeholder replacements.
 * @param {Boolean} isFilePath - Flag to indicate if templateInput is a file path (default: false).
 * @returns {String} The generated content with placeholders replaced.
 */
exports.generateContent = async (isFilePath = false, templateInput, replacements) => {
    try {
        let templateString;

        // Check if the template input is a file path or a raw template string
        if (isFilePath) {
            // Read the template file from the given path
            const templatesDir = path.join(__dirname, '..', '..', 'templates');
            const templatePath = path.join(templatesDir, `${templateInput}.html`);
            templateString = fs.readFileSync(templatePath, 'utf-8');
        } else {
            // Use the template string as is
            templateString = templateInput;
        }

        // Compile the template with Handlebars
        const template = Handlebars.compile(templateString);

        // Generate the content by applying the replacements
        const content = template(replacements);

        return content;
    } catch (error) {
        logger.error('Error generating content:', error);
        throw error;
    }
}

