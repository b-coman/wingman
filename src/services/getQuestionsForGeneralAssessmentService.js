// Filename: /src/services/processQuestionsBasedOnSignals.js

require('dotenv').config();
const agents = require('../../templates/agents.json');
const airtableUtils = require('../lib/airtableUtils');
const assetsUtils = require('../lib/knowledgeModelUtils');
const logger = require('../../logger');
const logFlowTracking = require('./flowTrackingService');
const wingmanAgentsService = require('./wingmanAgentsService');
const replacePlaceholders = require('./replacePlaceholders');
const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');

// select all questions that matches with the identified signals for a certain assessemnt
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>
// not finalized yet!!!
async function processQuestionsFromSignals(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {

        // Initial setup and logging
        // Similar initial steps as in processSignalsFromPains

        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where signals are stored
        var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
        assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id;
        logger.debug(`AssessmentDetails ID for signals: ${assessmentDetailsForSignalsId}`);


        // find the record ID in table AssessmentDetails where questions are stored
        var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
        assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id;
        logger.debug(`AssessmentDetails ID for questions: ${assessmentDetailsForQuestionsId}`);

        // get the pain IDs from AssessmentDetails
        const signalIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForSignalsId, 'AssessmentDetails:Signals');

        //logger.debug(signalIDs);

        // Fetch related questions for each signal ID
        const questionRecordIDs = await assetsUtils.getQuestionIDsForSignals(signalIDs);
        //logger.debug(`Questions found: ${JSON.stringify(questionRecordIDs, null, 2)}`);

        //construct the object that store details about signals
        const questionsData = [];
        for (const questionRecordId of questionRecordIDs) {
            try {
                const questionData = await airtableUtils.getFieldsForRecordById('Questions', questionRecordId);
                // Extract only the necessary fields
                const filteredQuestionData = {
                    QuestionRecordId: questionRecordId,
                    QuestionStatement: questionData['Statement'] || 'No question here', // Fallback to a default string if undefined
                    QuestionDescription: questionData['Description'] || '', // Convert undefined to null or a default string
                };
                questionsData.push(filteredQuestionData);
            } catch (error) {
                logger.error(`Error fetching data for signal record ID ${questionRecordId}: ${error}`);
            }
        }

      //  const jsonQuestionsData = JSON.stringify(questionsData);

      //  logger.debug(`Questions data: \n${JSON.stringify(questionsData, null, 4)}`);


     return JSON.stringify(questionsData, null, 2);

        // Prepare data for the agent
        const jsonQuestionData = JSON.stringify(questionsData);
        const taskPrompt = await replacePlaceholders.generateContent(
            isFilePath = false,
            agents.validateQuestions.prompt,
            {
                COMPANY: 'The company name', // Fetch the actual company name as needed
                QUESTIONSET_BODY: 'Initial research data', // Fetch or define the initial research data as needed
                QUESTIONSET_BODY: jsonQuestionData
            }
        );

        logger.debug(`taskPrompt \n${taskPrompt}`);


        // Agent call
        const agentData = {
            // Define the agent data object similarly
        };

        const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(
            agentData.CrewName,
            agentData.TaskDescription,
            taskPrompt,
            agents.validateQuestions.baseUrl
        );

        // Handle agent response
        // Similar to processSignalsFromPains, handle the agent's response, update Airtable, etc.


        logger.yay('Questions processing completed successfully.');

    } catch (error) {
        logger.error('An error occurred during question processing:', error);
    };

}

module.exports = { processQuestionsFromSignals };
