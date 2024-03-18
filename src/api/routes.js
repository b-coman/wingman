// /src/api/routes.js

const express = require('express');
const router = express.Router();
const airtableUtils = require('../lib/airtableUtils');
const newEngagementFlow = require('../flows/newEngagementFlow');
const { executeAssessmentFlow } = require('../services/assessmentTypeService');
const logger = require('../../logger'); 

// Handle form submissions
router.post('/submit-form', async (req, res) => {
    try {
        // Execute the new engagement flow with form data
        const flowResult = await newEngagementFlow.execute(req.body);

        // Log the successful submission
        logger.info('Form submitted successfully', { flowResult });

        // Respond with success message and relevant IDs from the flow result
        res.json({
            message: "Form submitted successfully",
            ...flowResult
        });
    } catch (error) {
        logger.error("Form submission error:", { error: error.message });

        res.status(500).send("An error occurred while submitting the form.");
    }
});


router.post('/start-assessment', async (req, res) => {
    try {
        const { assessmentId } = req.body;
        logger.info(`Starting assessment flow for AssessmentID: ${assessmentId}`);
        // Fetch the AssessmentType based on the provided AssessmentID
        const assessmentType = await airtableUtils.getAssessmentTypeById(assessmentId);
        if (!assessmentType) {
            logger.warn(`Assessment type not found for AssessmentID: ${assessmentId}`);
            return res.status(404).send('Assessment type not found');
        }
        // Execute the appropriate assessment flow
        await executeAssessmentFlow(assessmentId, assessmentType);
        logger.info(`Successfully completed assessment flow for AssessmentID: ${assessmentId}`);

        res.send('Assessment flow started successfully');
    } catch (error) {
        logger.error(`Failed to start assessment flow: ${error.message}`, error);
        res.status(500).send('Error starting assessment flow');
    }
});

module.exports = router;
