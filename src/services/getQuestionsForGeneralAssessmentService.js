// Filename: /src/services/processQuestionsBasedOnSignals.js

require('dotenv').config();
const { appConfig } = require('../../config');
const airtableUtils = require('../lib/airtableUtils');
const peopleUtils = require('../lib/peopleUtils');
const assetsUtils = require('../lib/knowledgeModelUtils');
const logger = require('../../logger');
const logFlowTracking = require('./flowTrackingService');
const wingmanAgentsService = require('./wingmanAgentsService');
const replacePlaceholders = require('./replacePlaceholders');
const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');

// select all questions that matches with the identified signals for a certain assessemnt
async function processQuestionsFromSignals(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {
        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where signals are stored
        var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
        assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id;
        // logger.debug(`AssessmentDetails ID for signals: ${assessmentDetailsForSignalsId}`);

        // find the record ID in table AssessmentDetails where questions are stored
        var assessmentDetailsForQuestionsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessQuestionsId);
        assessmentDetailsForQuestionsId = assessmentDetailsForQuestionsId[0].id;
        // logger.debug(`AssessmentDetails ID for questions: ${assessmentDetailsForQuestionsId}`);

        // find the record ID in table AssessmentDetails where initial research is stored
        var assessmentDetailsForReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessRawResultId);
        assessmentDetailsForReportId = assessmentDetailsForReportId[0].id

        // get the signal IDs from AssessmentDetails
        const signalRecordIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForSignalsId, 'AssessmentDetails:Signals');
        // logger.debug(JSON.stringify(signalRecordIDs, null, 2));

        // get the question record IDs that are connected to the signal IDs indentified before
        const questionRecordIDs = await assetsUtils.getQuestionIDsForSignals(signalRecordIDs);
        // logger.debug(`Questions found: ${JSON.stringify(questionRecordIDs, null, 2)}`);

        //construct the object that store details about role
        const contactRecordId = await peopleUtils.findPrimaryContactID(engagementRecordId);
        const contactDetails = await peopleUtils.fetchPeopleDetails(contactRecordId, 'contact');
        var roleDetails = `Role name: ${contactDetails.RoleName} \nRole Description: ${contactDetails.RoleDescription}`;
        // seriailze role data
        var jsonRoleDetails = JSON.stringify(roleDetails);

        //construct the object that store details about signals
        var signalsDescription = ""; var counter = 1;
        for (const signalRecordId of signalRecordIDs) {
            try {
                const signalData = await airtableUtils.getFieldsForRecordById('Signals', signalRecordId);
                const signalStatement = signalData['SignalStatement (from SignalID)'];
                signalsDescription += `Signal ${counter}: ${signalStatement}; \n`;
                counter++;
            } catch (error) {
                logger.error(`Error fetching data for signal record ID ${signalRecordId}: ${error}`);
            }
        }
        // seriailze signal data
        var jsonSignalDescription = JSON.stringify(signalsDescription);
       // logger.debug(`Serialized signals description: ${jsonSignalDescription}`);

        //construct the object that store details about questions
        const questionsData = [];
        for (const questionRecordId of questionRecordIDs) {
            try {
                const questionData = await airtableUtils.getFieldsForRecordById('Questions', questionRecordId);
                // Extract only the necessary fields
                const filteredQuestionData = {
                    questionSKU: questionData['QuestionSKU'],
                    questionBody: questionData['QuestionStatement'] || 'No question here',
                    isQuantitative: questionData['isQuantitative'] || false
                };
                questionsData.push(filteredQuestionData);
            } catch (error) {
                logger.error(`Error fetching data for signal record ID ${questionRecordId}: ${error}`);
            }
        }
        // serialiize signals data
        var jsonQuestionsData = JSON.stringify(questionsData);
      //  logger.debug(`Serialized questions data: \n${jsonQuestionsData}`);

        //prepare the agent call, the additional details needed
        const companyName = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyName (from CompanyID) (from assignedToEngagement)');
        var companyRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyID (from assignedToEngagement)');
        companyRecordId = companyRecordId[0];
        const rawReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForReportId, 'Value');
        // seriailze raw report
        const jsonRawReport = JSON.stringify(rawReport);

        const crewRecordId = await airtableUtils.findRecordIdByIdentifier('WingmanAIsquads', 'SquadSKU', 'identify_questions');
        const crewDetails = await airtableUtils.getFieldsForRecordById('WingmanAIsquads', crewRecordId);
        const crewName = crewDetails.SquadName;
        const crewJson = crewDetails.SquadJSON;

        //replace placeholders in the payload
        var crewPayload = await replacePlaceholders.generateContent(isFilePath = false, crewJson, {
            COMPANY: companyName,
            INITIAL_RESEARCH: jsonRawReport.replace(/"/g, '\\"'),
            SIGNALS_LIST: jsonSignalDescription.replace(/"/g, '\\"'),
            QUESTIONS_LIST: jsonQuestionsData.replace(/"/g, '\\"'),
            ROLE: jsonRoleDetails.replace(/"/g, '\\"')

        });

        logger.info(`Agent payload: \n${crewPayload}`);
        logger.warn("Now calling agent...");

        // Start tracking the agent activity
        const runID = await airtableUtils.createAgentActivityRecord(companyRecordId, crewName, crewPayload);
        logger.info(`Agent activity run ID: ${runID}, type: ${typeof runID}`);

        // Call the agent army with the payload // schema path is used to validate the response
        const schemaPath = '../../schema/crewAiResponseSchema_questions.json';
        const agentResponse = await wingmanAgentsService.callWingmanAgents(crewPayload, schemaPath);

        // extract the questions from the response
        var agentResponseResult = agentResponse.result;
        logger.info(`Here is the response: \n ${JSON.stringify(agentResponse, null, 4)}`);

        // Complete tracking the agent activity with the response
        await airtableUtils.updateAgentActivityRecord(runID, JSON.stringify(agentResponse, null, 4));

        // insert the questions identified by the agent into the AssessmentDetails:Questions table
        await airtableUtils.createQuestionAssessmentDetails(agentResponseResult, assessmentDetailsForQuestionsId, runID);

        // Complete tracking the agent activity with the response
        await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

        // make the update to AssessmentDetails with the agent result, and the status
        agentResponseResult = JSON.stringify(agentResponseResult)
        const assessmentDetailsStatus = appConfig.questionRequireApproval ? 'pending' : 'approved'; // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approava;
        await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessQuestionsId, assessmentDetailsStatus);

        // update the status for the current assessment
        await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'questions selected');

        logger.yay('Questions processing completed successfully.');



    } catch (error) {
        logger.error('An error occurred during question processing:', error);
    };

}

module.exports = { processQuestionsFromSignals };
