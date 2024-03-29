const { logger } = require('handlebars');
const CreateFormService = require('../src/services/createFormService'); // Make sure the path is correct

// Mock question IDs - replace these with actual IDs from your Airtable "Questions" table
const mockQuestionIDs = ['recsokbQ8m7E9FxYX', 'recdTPBgg1wkjssCf'];

// Define a sample survey name and description
const formName = "Test Survey";
const formDescription = "This is a test survey generated from Airtable questions.";

// Instantiate TypeformService
const typeformService = new CreateFormService();

// Call the createSurvey method
(async () => {
    try {
        const { formId, formUrl } = await typeformService.createForm(formName, formDescription, mockQuestionIDs);

        logger.info(`Form created successfully: ${formId}`);
        logger.info(`Form created successfully: ${formUrl}`);
    } catch (error) {
        console.error(`Error creating survey: ${error.message}`);
    }
})();
