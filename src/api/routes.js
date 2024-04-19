// /src/api/routes.js

const express = require('express');
const router = express.Router();
const airtableUtils = require('../lib/airtableUtils');
const newEngagementFlow = require('../flows/newEngagementFlow');
const doEngagementFlow = require('../flows/engagementFlow');
const { executeAssessmentFlow } = require('../services/assessmentTypeService');
const logger = require('../../logger'); 

// Handle form submissions
router.post('/submit-form', async (req, res) => {
    try {
        // Execute the new engagement flow with form data
        const flowResult = await newEngagementFlow.execute(req.body);

        // Log the successful submission
        logger.yay(`Form submitted successfully: ${JSON.stringify(flowResult)}`);

        // Respond with success message and relevant IDs from the flow result
        res.json({
            message: "Form submitted successfully",
            ...flowResult
        });
    } catch (error) {
        logger.error(`Form submission error: ${error.message}`);


        res.status(500).send("An error occurred while submitting the form.");
    }
});


router.post('/start-engagement', async (req, res) => {
    try {
        const { engagementRecordId } = req.body;
        logger.info(`Starting engagement flow for EngagementID: ${engagementRecordId}`);

        // Fetch the EngagementStatus and engagementId based on the provided engagement record ID
        const engagementStatus = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'EngagementStatus');
        const engagementId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'EngagementID');

        logger.info(`Engagement status: ${engagementStatus}`);
        logger.info(`Engagement ID: ${engagementId}`);
        logger.info(`Engagement record ID: ${engagementRecordId}`);

        if (!engagementStatus) {
            logger.warn(`Engagement status not found for EngagementID: ${engagementId}`);
            return res.status(404).send('Engagement status not found');
        }

        // Execute engagement flow
        await doEngagementFlow(engagementRecordId, engagementId, engagementStatus);
        logger.yay(`Successfully completed Engagement flow for EngagementID: ${engagementId}`);

        res.json({ message: 'route /start-engagement ended successfully' });
    } catch (error) {
        logger.error(`Failed to start engagement flow: ${error.message}`, error);
        res.status(500).send('Error starting engagement flow');
    }
});

router.post('/start-assessment', async (req, res) => {
    try {
        const { assessmentRecordId } = req.body;
        logger.info(`Starting assessment flow for AssessmentID: ${assessmentRecordId}`);
        // Fetch the AssessmentType based on the provided AssessmentID
        const assessmentType = await airtableUtils.getAssessmentTypeById(assessmentRecordId);
        if (!assessmentType) {
            logger.warn(`Assessment type not found for AssessmentID: ${assessmentRecordId}`);
            return res.status(404).send('Assessment type not found');
        }
        // Execute the appropriate assessment flow
        await executeAssessmentFlow(assessmentRecordId, assessmentType);
        logger.yay(`Successfully completed /start-assessment route for Assessment: ${assessmentRecordId}`);

        res.send('Assessment flow started successfully');
    } catch (error) {
        logger.error(`Failed to start assessment flow: ${error.message}`, error);
        res.status(500).send('Error starting assessment flow');
    }
});

router.post('/typeform', async (req, res) => {
    try {
        const payload = req.body;
        logger.info('Received Typeform webhook:', payload);

        // Example: Extracting and logging a simple piece of data
        const formId = payload.form_response.form_id;
        const answers = payload.form_response.answers.map(answer => {
            return {
                question: answer.field.ref,
                type: answer.type,
                answer: answer[answer.type] // Assumes that answer type (e.g., 'text', 'choice') matches key in answer object
            };
        });

        // Example: Process and map answers to Airtable (pseudo-code)
        for (const answer of answers) {
            // Your logic to map and process answers here
            console.log(answer);
            // e.g., await saveAnswerToAirtable(answer);
        }

        res.status(200).send('Webhook received');
    } catch (error) {
        logger.error("Typeform webhook handling error:", { error: error.message });
        res.status(500).send("An error occurred while handling Typeform webhook.");
    }
});


module.exports = router;
