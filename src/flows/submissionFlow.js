require('dotenv').config();
const replacePlaceholders = require('../services/replacePlaceholders');
const { sendEmail } = require('../services/emailService');
const wingmanAgentsService = require('../services/wingmanAgentsService');
const airtableUtils = require('../lib/airtableUtils');
const { validateJson } = require('../services/jsonValidationService');
const logger = require('../../logger');
const logFlowTracking = require('../services/flowTrackingService');
const { systemRules, agents, emails, htmlTemplates } = require('../../config');


const flowName = 'submissionFlow';
const doSubmissionFlow = async (formId, answers) => {
    try {
        logger.info(`Form ID: ${formId}`);
        logger.info(`Received answer: ${JSON.stringify(answers)}`);

        const surveyRecordId = await airtableUtils.findRecordIdByIdentifier('Surveys', 'formID', formId);
        logger.info(`Survey Record ID: ${surveyRecordId}`);

        const submissionRecordId = await airtableUtils.createRecord('Surveys:Submissions', {
            'SurveyID': [surveyRecordId],
            'SubmissionDate': new Date().toISOString()
        });
        logger.info(`Submission Record ID: ${submissionRecordId}`);

        for (const answer of answers) {
            const questionRecordId = await airtableUtils.findRecordIdByIdentifier('Questions', 'QuestionSKU', answer.field.ref);
            await airtableUtils.createRecord('Surveys:Submissions:Responses', {
                'SubmissionID': [submissionRecordId],
                'QuestionID': [questionRecordId],
                'ResponseValue': String(answer[answer.type]) // Accessing the answer based on its type
            });
        }

        // update status for assessment in Assessments table
        const assessmentRecord = await airtableUtils.findFieldValueByRecordId('Surveys', surveyRecordId, 'AssessmentID');
        const assessmentRecordId = assessmentRecord[0];
        await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'survey responded');

        logger.info(`Submission and responses recorded successfully for SurveyID ${surveyRecordId}`);
    } catch (error) {
        logger.error(`Error in engagement flow for EngagementID ${formId}: ${error}`);
        throw error;
    }
};

module.exports = doSubmissionFlow;
