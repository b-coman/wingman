// Filename: /src/services/updateAssessmentDetailsService.js

const airtableUtils = require('../lib/airtableUtils'); // Adjust the path as needed
const logger = require('../../logger'); // Adjust the path as needed
const { config } = require('dotenv');

/**
 * Updates assessment details and status based on the given assessment ID.
 *
 * @param {String} assessmentId The ID of the assessment to update.
 * @param {String} assessmentRecordId The record ID of the assessment.
 * @param {String} agentResponseResult The response result from the agent to store in assessment details.
 * @param {String} envDefaultGenAssessRawResultId The environment variable indicating the template ID for finding assessment details.
 */
exports.updateAssessmentDetailsAndStatus = async (assessmentId, assessmentRecordId, agentResponseResult, envIDtemplate, assessmentDetailsStatus) => {
    try {
        // Identify the record that should be updated
        var assessmentDetails = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, envIDtemplate);
        if (assessmentDetails.length === 0) {
            throw new Error("No assessment details found for the given criteria.");
        }
        const assessmentDetailsId = assessmentDetails[0].id;

        // Update the assessment details with the agent response
        await airtableUtils.updateRecordField('AssessmentDetails', assessmentDetailsId, 'Value', agentResponseResult);
        await airtableUtils.updateRecordField('AssessmentDetails', assessmentDetailsId, 'Status', assessmentDetailsStatus);
        await airtableUtils.updateRecordField('AssessmentDetails', assessmentDetailsId, 'Date', new Date().toISOString());

        logger.info(`Assessment details and status updated successfully for assessment ID: ${assessmentId}`);
    } catch (error) {
        logger.error(`Error updating assessment details and status: ${error}`);
        throw error;
    }
};
