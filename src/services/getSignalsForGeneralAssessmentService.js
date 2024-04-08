// Filename: /src/services/getSignalsForGeneralAssessmentService.js

require('dotenv').config();
const agents = require('../../templates/agents.json');
const emails = require('../../templates/emails.json');
const { appConfig } = require('../../config');
const airtableUtils = require('../lib/airtableUtils'); 
const assetsUtils = require('../lib/knowledgeModelUtils');
const logger = require('../../logger'); 
const logFlowTracking = require('./flowTrackingService');
const wingmanAgentsService = require('./wingmanAgentsService');
const replacePlaceholders = require('./replacePlaceholders');
const updateAssessmentDetailsService = require('./updateAssessmentDetailsService');


// this will select all signals related to pains already approved for an assessment, and then validate them with an agent
async function processSignalsFromPains(engagementRecordId, assessmentRecordId, assessmentId, flowName, flowStatus) {
    try {
        await logFlowTracking({ flowName: flowName, flowStatus: flowStatus, flowStep: 'identify signals', stepStatus: 'OK', timestamp: new Date().toISOString(), engagementId: engagementRecordId, assessmentId: assessmentRecordId, additionalInfo: {} });

        // find the record ID in table AssessmentDetails where signals are stored
        var assessmentDetailsForSignalsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessSignalsId);
        assessmentDetailsForSignalsId = assessmentDetailsForSignalsId[0].id;

        // find the record ID in table AssessmentDetails where pains are stored
        var assessmentDetailsForPainsId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessPainPointsId);
        assessmentDetailsForPainsId = assessmentDetailsForPainsId[0].id;

        // find the record ID in table AssessmentDetails where final result is stored
        var assessmentDetailsForReportId = await airtableUtils.findAssessDetailsByAssessIDAndTemplate(assessmentId, process.env.envDefaultGenAssessFinalResultId);
        assessmentDetailsForReportId = assessmentDetailsForReportId[0].id

        // get the pain IDs from AssessmentDetails
        const painIDs = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForPainsId, 'AssessmentDetails:Pains');

        // get the signal record IDs from that relates to the pain IDs indentified before
        const signalRecordIDs = await assetsUtils.getSignalIDsForPains(painIDs);

        //construct the object that store details about signals
        const signalsData = [];
        for (const signalRecordId of signalRecordIDs) {
            try {
                const signalData = await airtableUtils.getFieldsForRecordById('Signals', signalRecordId);
                // Extract only the necessary fields
                const filteredSignalData = {
                    SignalRecordId: signalRecordId,
                    SignalStatement: signalData['SignalStatement'] || 'No signal here',
                    SignalDescription: signalData['SignalDescription'] || ''
                };
                signalsData.push(filteredSignalData);
            } catch (error) {
                logger.error(`Error fetching data for signal record ID ${signalRecordId}: ${error}`);
            }
        }

        var jsonSignalsData = JSON.stringify(signalsData);

        //prepare the agent call, the additional details needed
        const companyName = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyName (from CompanyID) (from assignedToEngagement)');
        var companyRecordId = await airtableUtils.findFieldValueByRecordId('Assessments', assessmentRecordId, '*CompanyID (from assignedToEngagement)');
        companyRecordId = companyRecordId[0];
        const finalReport = await airtableUtils.findFieldValueByRecordId('AssessmentDetails', assessmentDetailsForReportId, 'Value');

        // replace placeholders, create task prompt
        var taskPrompt = await replacePlaceholders.generateContent(isFilePath = false, agents.validateSignals.prompt, { COMPANY: companyName, INITIAL_RESEARCH: finalReport, SIGNALS_LIST: jsonSignalsData });

        // create the agent data object --> this is the data that will be sent to the agent army
        const agentData = {
            CompanyID: companyRecordId,
            CrewName: 'analyse_data',
            TaskDescription: agents.validateSignals.description,
            TaskPrompt: taskPrompt,
            Timestamp: new Date().toISOString()
        };

        // agent activity tracking - start
        const runID = await airtableUtils.createAgentActivityRecord(agentData.CompanyID, agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt);

        // call the agent army :)
        logger.info(`Calling crew: ${agentData.CrewName}`);
        const agentResponse = await wingmanAgentsService.callWingmanAgentsApp(agentData.CrewName, agentData.TaskDescription, agentData.TaskPrompt, agents.validateSignals.baseUrl);

        var agentResponseResult = agentResponse.result;
        agentResponseResult = JSON.parse(agentResponseResult);

        // insert the signals identified by the agent into the AssessmentDetails:Signals table
        await airtableUtils.createSignalAssessmentDetails(agentResponseResult, assessmentDetailsForSignalsId, runID);

        // Complete tracking the agent activity with the response
        await airtableUtils.updateAgentActivityRecord(runID, agentResponse);

        // make the update to AssessmentDetails with the agent result, and the status
        agentResponseResult = JSON.stringify(agentResponseResult)
        const assessmentDetailsStatus = appConfig.signalRequireApproval ? 'pending' : 'approved'; // check if this step requires approaval or not --> so set the staus as 'approved' if doesn't require approava;
        await updateAssessmentDetailsService.updateAssessmentDetailsAndStatus(assessmentId, assessmentRecordId, agentResponseResult, process.env.envDefaultGenAssessSignalsId, assessmentDetailsStatus);

        // update the status for the current assessment
        await airtableUtils.updateRecordField('Assessments', assessmentRecordId, 'AssessmentStatus', 'signals done');

        logger.yay('Signals processing completed successfully.');

    } catch (error) {
        logger.error('An error occurred during signal processing:', error);
    };

}

module.exports = { processSignalsFromPains };