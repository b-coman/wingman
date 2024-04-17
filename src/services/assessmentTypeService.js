// /src/services/assessmentTypeService.js

require('dotenv').config();
const Airtable = require('airtable');
const airtableUtils = require('../lib/airtableUtils');
const logger = require('../../logger');
const engagementPromptsService = require('./engagementPromptsService'); // Ensure this path is correct

const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Importing the assessment flow functions from the /flows directory
const doAssessmentGeneral = require('../flows/assessmentGeneral');
//const doAssessmentSpecific = require('../flows/assessmentSpecific');
//const doAssessmentComprehensive = require('../flows/assessmentComprehensive');

// Function to execute the appropriate assessment flow based on the assessment type
exports.executeAssessmentFlow = async (assessmentRecordId, assessmentType) => {
    try {
        switch (assessmentType) {
            case 'General':
                // extracts appropriate parameters from the database

                //finds the value of AssessmentID field based on its record ID
                const assessmentId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, 'AssessmentID');
                //logger.info(`assessmentId: ${assessmentId}`);

                var engagementRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, 'assignedToEngagement');
                //logger.info(`engagementRecordId: ${engagementRecordId}`);

                // what's next is important because the prefious function returned it as an object
                engagementRecordId = engagementRecordId[0];
                //logger.info(`Engagement record ID: ${engagementRecordId}`);

                // finds the value of EngagementID field based on record ID
                const engagementId = await airtableUtils.findFieldValueByRecordId('Engagements', engagementRecordId, 'EngagementID');
                //logger.info(`engagementId: ${engagementId}`);

                // finds the value of EngagementPrompts field based on record ID
                const promptsIDs = await airtableUtils.findFieldValueByRecordId('EngagementPrompts', engagementRecordId, '*EngagementPrompts');
                //logger.info(`promptsIDs: ${promptsIDs}`);

                // finds the value of ApprovedPromptID
                const approvedPromptRecordId = await engagementPromptsService.findApprovedPromptRecord(promptsIDs);
                //logger.info(`approvedPromptId: ${approvedPromptRecordId}`);
                
                await doAssessmentGeneral(engagementRecordId, engagementId, assessmentRecordId, assessmentId, approvedPromptRecordId);
                break;
            case 'Specific':
                //await doAssessmentSpecific(assessmentRecordId);
                break;
            case 'Comprehensive':
                //await doAssessmentComprehensive(assessmentRecordId);
                break;
            default:
                logger.error(`Unknown assessment type: ${assessmentType} for AssessmentID ${assessmentRecordId}`);
                throw new Error(`Unknown assessment type: ${assessmentType}`);
        }

        logger.yay(`Successfully completed the ${assessmentType} flow for ${assessmentRecordId} (assessmentTypeService.js)`);
    } catch (error) {
        logger.error(`Error executing ${assessmentType} flow for ${assessmentRecordId}: ${error}`);
        throw error;
    } 
}
